// Borra los productos de prueba (_id "seed-*") y las imágenes que subió el seed.
// No toca la configuración. Uso: npm run seed:limpiar (antes de salir a producción).
import 'dotenv/config'
import { createClient } from '@sanity/client'

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

async function main() {
  console.log(`Limpiando el seed en ${client.config().projectId}/${client.config().dataset}`)

  // Primero los productos: Sanity no deja borrar un asset que todavía está referenciado
  const productos = await client.fetch('*[_type == "producto" && string::startsWith(_id, "seed-")]._id')
  if (productos.length) {
    const tx = client.transaction()
    for (const id of productos) tx.delete(id)
    await tx.commit()
  }
  console.log(`  productos borrados: ${productos.length}`)

  const assets = await client.fetch('*[_type == "sanity.imageAsset" && string::startsWith(originalFilename, "seed-")]._id')
  if (assets.length) {
    const tx = client.transaction()
    for (const id of assets) tx.delete(id)
    await tx.commit()
  }
  console.log(`  imágenes borradas: ${assets.length}`)
  console.log('\nListo. La configuración no se tocó.')
}

main().catch((err) => {
  console.error('\nLa limpieza falló:', err.message)
  process.exitCode = 1
})
