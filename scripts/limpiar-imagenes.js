// Borra las imágenes de Sanity que no usa ningún documento y tienen más de 24 horas:
// fotos que se subieron desde el formulario del panel y nunca se guardaron en un producto.
// Uso: npm run imagenes:limpiar (pide confirmación) o npm run imagenes:limpiar -- --si
import 'dotenv/config'
import { createInterface } from 'node:readline/promises'
import { createClient } from '@sanity/client'

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

  const [huerfanas, total] = await Promise.all([
    client.fetch(
      `*[_type == "sanity.imageAsset" && _createdAt < $limite && count(*[references(^._id)]) == 0]
        | order(_createdAt asc){ _id, originalFilename, size, _createdAt }`,
      { limite },
    ),
    client.fetch('count(*[_type == "sanity.imageAsset"])'),
  ])

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
