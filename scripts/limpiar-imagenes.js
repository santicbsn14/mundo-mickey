// Borra las imágenes de Sanity que no usa ningún documento y tienen más de 24 horas:
// fotos que se subieron desde el formulario del panel y nunca se guardaron en un producto.
// Respeta las fotos de los pedidos (items.imagenUrl en Mongo): si no puede leerlos, no borra nada.
// Uso: npm run imagenes:limpiar (pide confirmación) o npm run imagenes:limpiar -- --si
import 'dotenv/config'
import { createInterface } from 'node:readline/promises'
import { createClient } from '@sanity/client'
import mongoose from 'mongoose'

const HORAS = 24

function requerirEnv(nombre) {
  const valor = process.env[nombre]
  if (!valor?.trim()) throw new Error(`Falta la variable de entorno ${nombre} en .env`)
  return valor
}

const client = createClient({
  projectId: requerirEnv('SANITY_PROJECT_ID'),
  dataset: requerirEnv('SANITY_DATASET'),
  apiVersion: '2026-10-01',
  token: requerirEnv('SANITY_WRITE_TOKEN'),
  useCdn: false,
})

/** …/<hash>-<ancho>x<alto>.<ext> → image-<hash>-<ancho>x<alto>-<ext>, o null si no es una URL de imagen de Sanity. */
function idDeUrl(url) {
  const m = typeof url === 'string' && url.match(/\/images\/[^/]+\/[^/]+\/([a-zA-Z0-9]+-\d+x\d+)\.([a-z0-9]+)(?:[?#].*)?$/)
  return m ? `image-${m[1]}-${m[2]}` : null
}

/** Ids de los assets que usa algún pedido. Tira un Error si no puede leer Mongo. */
async function idsEnPedidos() {
  await mongoose.connect(requerirEnv('MONGODB_URI'), { serverSelectionTimeoutMS: 8000 })
  try {
    const urls = await mongoose.connection.db.collection('pedidos').distinct('items.imagenUrl')
    return new Set(urls.map(idDeUrl).filter(Boolean))
  } finally {
    await mongoose.disconnect()
  }
}

const kb = (bytes) => `${Math.round((bytes ?? 0) / 1024)} KB`

async function confirmar(pregunta) {
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  try {
    return /^(s|si|sí)$/i.test((await rl.question(pregunta)).trim())
  } finally {
    rl.close()
  }
}

async function main() {
  const limite = new Date(Date.now() - HORAS * 60 * 60 * 1000).toISOString()
  console.log(`Imágenes huérfanas de más de ${HORAS} horas en ${client.config().projectId}/${client.config().dataset}`)

  let enPedidos
  try {
    enPedidos = await idsEnPedidos()
  } catch (err) {
    console.error(`\nNo se pudieron leer los pedidos de MongoDB (${err.message}).`)
    console.error('No se borró nada: sin los pedidos no se sabe qué fotos usan.')
    process.exitCode = 1
    return
  }
  console.log(`  fotos usadas en pedidos: ${enPedidos.size}`)

  const [candidatas, total] = await Promise.all([
    client.fetch(
      `*[_type == "sanity.imageAsset" && _createdAt < $limite && count(*[references(^._id)]) == 0]
        | order(_createdAt asc){ _id, originalFilename, size, _createdAt }`,
      { limite },
    ),
    client.fetch('count(*[_type == "sanity.imageAsset"])'),
  ])

  const huerfanas = candidatas.filter((img) => !enPedidos.has(img._id))
  console.log(`  imágenes en total: ${total}`)
  console.log(`  sin usar y con más de ${HORAS} horas: ${huerfanas.length}`)
  if (huerfanas.length === 0) return console.log('\nNo hay nada para borrar.')

  for (const img of huerfanas) {
    console.log(`  - ${img.originalFilename ?? img._id} (${kb(img.size)}, subida el ${img._createdAt.slice(0, 10)})`)
  }

  const borrarSinPreguntar = process.argv.includes('--si')
  const cuales = huerfanas.length === 1 ? 'esta imagen' : `estas ${huerfanas.length} imágenes`
  if (!borrarSinPreguntar && !(await confirmar(`\n¿Borrar ${cuales}? (s/N) `))) {
    return console.log('No se borró nada.')
  }

  // De a una: si alguna pasó a estar en uso mientras tanto, Sanity no la deja borrar y se sigue con las demás
  let borradas = 0
  for (const img of huerfanas) {
    try {
      await client.delete(img._id)
      borradas++
    } catch (err) {
      console.warn(`  no se borró ${img._id}: ${err.message}`)
    }
  }
  console.log(`\nListo: ${borradas} de ${huerfanas.length} imágenes borradas.`)
}

main().catch((err) => {
  console.error('\nLa limpieza falló:', err.message)
  process.exitCode = 1
})
