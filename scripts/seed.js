// Carga 6 productos de prueba (con las ilustraciones de la maqueta) y la configuración.
// Uso: npm run seed. Se puede correr varias veces: no duplica nada.
import 'dotenv/config'
import { readFile } from 'node:fs/promises'
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

const MAQUETA = new URL('../docs/referencia/maqueta.html', import.meta.url)

// Mismos datos que la maqueta (docs/referencia/maqueta.html)
const PRODUCTOS = [
  { ilus: 'osito', nombre: 'Osito de peluche gigante', descripcion: '60 cm de puro abrazo. Súper suave y apto desde bebés.', precio: 34900, stock: 3, badge: 'El más pedido', destacado: true },
  { ilus: 'dino', nombre: 'Dino de peluche', descripcion: '40 cm, relleno firme.', precio: 21500, stock: 5, badge: 'Nuevo' },
  { ilus: 'cohete', nombre: 'Cohete con luces', descripcion: 'Luces y sonido, a pilas.', precio: 18900, stock: 4 },
  { ilus: 'robot', nombre: 'Robot que camina', descripcion: 'Camina, gira y hace ruidos.', precio: 26400, stock: 2, badge: 'Últimas 2' },
  { ilus: 'conejo', nombre: 'Conejito de apego', descripcion: 'Ideal para dormir, 30 cm.', precio: 15900, stock: 6 },
  { ilus: 'pelota', nombre: 'Pelota saltarina', descripcion: 'Goma blanda, 22 cm.', precio: 9800, stock: 8 },
]

const CONFIGURACION = {
  _id: 'configuracion',
  _type: 'configuracion',
  whatsapp: '5493360000000',
  instagram: 'mundomickey',
  direccion: 'Dirección del local, San Nicolás de los Arroyos',
  horarios: 'Lunes a sábados de 9 a 13 y de 17 a 21',
  mapaUrl: '',
  envioLocal: { habilitado: true, costo: 3000, texto: 'Solo San Nicolás' },
  envioNacional: {
    habilitado: true,
    texto: 'Coordinamos el envío por WhatsApp. Se paga aparte o en destino.',
  },
  marquesina: ['Peluches', 'Juguetes en tendencia', 'Pagá con Mercado Pago', 'Retiro en el local', 'Envíos en San Nicolás'],
}

/** Extrae los SVG del objeto `const ilus = { nombre: `<svg…>`, … }` de la maqueta. */
async function extraerIlustraciones() {
  const html = await readFile(MAQUETA, 'utf8')
  const bloque = html.match(/const ilus = \{([\s\S]*?)\n\s*\};/)
  if (!bloque) throw new Error('No se encontró el objeto `ilus` en la maqueta')

  const ilus = {}
  for (const [, nombre, svg] of bloque[1].matchAll(/(\w+):\s*`([\s\S]*?)`/g)) {
    ilus[nombre] = svg.includes('xmlns=') ? svg : svg.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"')
  }
  return ilus
}

function slugificar(texto) {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

async function main() {
  console.log(`Seed en ${client.config().projectId}/${client.config().dataset}`)
  const ilus = await extraerIlustraciones()

  const tx = client.transaction()
  for (const [i, p] of PRODUCTOS.entries()) {
    const svg = ilus[p.ilus]
    if (!svg) throw new Error(`La maqueta no tiene la ilustración "${p.ilus}"`)

    // Sanity deduplica los assets por contenido: subir el mismo SVG otra vez devuelve el mismo asset
    const asset = await client.assets.upload('image', Buffer.from(svg, 'utf8'), {
      filename: `seed-${p.ilus}.svg`,
      contentType: 'image/svg+xml',
    })
    console.log(`  imagen seed-${p.ilus}.svg → ${asset._id}`)

    tx.createOrReplace({
      _id: `seed-${p.ilus}`,
      _type: 'producto',
      nombre: p.nombre,
      slug: { _type: 'slug', current: slugificar(p.nombre) },
      descripcion: p.descripcion,
      precio: p.precio,
      stock: p.stock,
      imagenes: [{ _type: 'image', _key: p.ilus, asset: { _type: 'reference', _ref: asset._id } }],
      ...(p.badge && { badge: p.badge }),
      destacado: p.destacado === true,
      activo: true,
      orden: i + 1,
    })
  }

  // Nunca pisa una configuración existente
  tx.createIfNotExists(CONFIGURACION)
  const configAntes = await client.fetch('defined(*[_id == "configuracion"][0]._id)')
  await tx.commit()

  const total = await client.fetch('count(*[_type == "producto" && string::startsWith(_id, "seed-")])')
  console.log(`\nListo: ${total} productos de prueba en Sanity.`)
  console.log(configAntes ? 'Configuración: ya existía, no se tocó.' : 'Configuración: creada con datos de ejemplo.')
}

main().catch((err) => {
  console.error('\nEl seed falló:', err.message)
  process.exitCode = 1
})
