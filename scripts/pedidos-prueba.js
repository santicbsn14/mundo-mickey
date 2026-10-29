// Pedidos de prueba para el panel, con los productos reales del catálogo. No toca el stock.
// Uso: npm run pedidos:prueba            → crea 10 pedidos
//      npm run pedidos:prueba -- --borrar → borra todos los pedidos y el contador
// Solo corre contra una base que termina en "-dev": nunca toca la de producción.
import 'dotenv/config'
import { conectarDB } from '../server/config/db.js'
import { sanityLectura } from '../server/lib/sanity.js'
import Counter, { siguienteNumero } from '../server/models/Counter.js'
import Pedido from '../server/models/Pedido.js'

const BORRAR = process.argv.includes('--borrar')
const HORA = 60 * 60 * 1000
const DIA = 24 * HORA

/** Nombre de la base en la cadena de conexión: lo que va después del primer `/` tras los hosts. */
function nombreBase(uri) {
  return uri.match(/^mongodb(?:\+srv)?:\/\/[^/]+\/([^?]*)/)?.[1] ?? ''
}

const base = nombreBase(process.env.MONGODB_URI ?? '')
if (!base.endsWith('-dev')) {
  console.error(`✋ La base de MONGODB_URI es "${base || '(ninguna)'}" y no termina en "-dev". Este script solo corre contra la base de desarrollo.`)
  process.exit(1)
}

const m = await conectarDB()
// Por las dudas, se vuelve a mirar la base a la que de verdad se conectó
if (!m.connection.name.endsWith('-dev')) {
  console.error(`✋ Se conectó a "${m.connection.name}", que no termina en "-dev". No se hace nada.`)
  await m.disconnect()
  process.exit(1)
}

if (BORRAR) {
  const { deletedCount } = await Pedido.deleteMany({})
  await Counter.deleteOne({ _id: 'pedido' })
  console.log(`Base ${m.connection.name}: ${deletedCount} pedidos borrados y el contador en cero.`)
  await m.disconnect()
  process.exit(0)
}

const productos = await sanityLectura().fetch(
  '*[_type == "producto" && defined(precio)] | order(orden asc){ _id, nombre, precio, "imagenUrl": imagenes[0].asset->url }',
)
if (productos.length < 3) {
  console.error('Hacen falta al menos 3 productos en Sanity (corré `npm run seed`).')
  await m.disconnect()
  process.exit(1)
}
const config = await sanityLectura().fetch('*[_id == "configuracion"][0]{ envioLocal }')
const COSTO_LOCAL = config?.envioLocal?.costo ?? 3000

const p = (i) => productos[i % productos.length]
const item = (i, cantidad) => ({ productoId: p(i)._id, nombre: p(i).nombre, precioUnitario: p(i).precio, cantidad, imagenUrl: p(i).imagenUrl ?? undefined })

const SAN_NICOLAS = { localidad: 'San Nicolás de los Arroyos', provincia: 'Buenos Aires' }

// `hace`: cuánto antes de ahora se creó. `pasos`: cuánto después de crearse cambió a cada estado.
const PRUEBAS = [
  {
    hace: 9 * DIA + 3 * HORA, estado: 'cancelado', pasos: { cancelado: 26 * HORA },
    cliente: { nombre: 'Martín', apellido: 'Gómez', dni: '28456123', celular: '5493364558812', email: 'martin.gomez@ejemplo.com' },
    entrega: { tipo: 'envio_local', direccion: { calle: 'Mitre', numero: '845', ...SAN_NICOLAS, codigoPostal: '2900' } },
    items: [item(1, 1)],
  },
  {
    hace: 8 * DIA, estado: 'entregado', pasos: { pagado: 4 * 60 * 1000, enviado: 20 * HORA, entregado: 26 * HORA },
    cliente: { nombre: 'Sofía', apellido: 'Rodríguez', dni: '35111222', celular: '5493364112233', email: 'sofi.rodriguez@ejemplo.com' },
    entrega: { tipo: 'envio_local', direccion: { calle: 'Av. Savio', numero: '1520', pisoDepto: '3° A', ...SAN_NICOLAS, codigoPostal: 'B2900ABC' } },
    items: [item(0, 1), item(4, 1)],
  },
  {
    hace: 6 * DIA + 5 * HORA, estado: 'entregado', pasos: { pagado: 2 * 60 * 1000, entregado: 2 * DIA },
    cliente: { nombre: 'José', apellido: 'Núñez', dni: '24987654', celular: '5493415667788', email: 'jose.nunez@ejemplo.com' },
    entrega: { tipo: 'retiro' },
    items: [item(2, 2)],
  },
  {
    hace: 4 * DIA + 2 * HORA, estado: 'enviado', pasos: { pagado: 6 * 60 * 1000, enviado: DIA },
    cliente: { nombre: 'Valentina', apellido: 'López', dni: '40123987', celular: '5493512345678', email: 'vale.lopez@ejemplo.com' },
    entrega: { tipo: 'envio_nacional', direccion: { calle: 'Bv. San Juan', numero: '450', pisoDepto: '7° C', localidad: 'Córdoba', provincia: 'Córdoba', codigoPostal: 'X5000ABC' } },
    items: [item(0, 1), item(1, 1)],
    seguimiento: { empresa: 'Andreani', codigo: '360002456789120' },
  },
  {
    hace: 3 * DIA + 1 * HORA, estado: 'enviado', pasos: { pagado: 3 * 60 * 1000, enviado: 5 * HORA },
    cliente: { nombre: 'Lucía', apellido: 'Fernández', dni: '33555444', celular: '5493364998877', email: 'lucia.f@ejemplo.com' },
    entrega: { tipo: 'envio_local', direccion: { calle: 'Belgrano', numero: '230', ...SAN_NICOLAS, codigoPostal: '2900' } },
    items: [item(5, 3)],
  },
  {
    hace: 2 * DIA + 4 * HORA, estado: 'pagado', pasos: { pagado: 5 * 60 * 1000 }, sobreventa: 1, // había 1 y se vendieron 2
    cliente: { nombre: 'Agustín', apellido: 'Pérez', dni: '38222111', celular: '5491155443322', email: 'agus.perez@ejemplo.com' },
    entrega: { tipo: 'envio_nacional', direccion: { calle: 'Av. Corrientes', numero: '3456', pisoDepto: '10° B', localidad: 'Ciudad Autónoma de Buenos Aires', provincia: 'Ciudad Autónoma de Buenos Aires', codigoPostal: 'C1193AAN' } },
    items: [item(3, 2), item(4, 1)],
  },
  {
    hace: 30 * HORA, estado: 'pendiente_pago', pasos: {}, estadoPago: ['rejected', 'cc_rejected_insufficient_amount'],
    cliente: { nombre: 'Camila', apellido: 'Martínez', dni: '42333666', celular: '5493416112233', email: 'cami.martinez@ejemplo.com' },
    entrega: { tipo: 'envio_nacional', direccion: { calle: 'Córdoba', numero: '1200', localidad: 'Rosario', provincia: 'Santa Fe', codigoPostal: 'S2000ABC' } },
    items: [item(0, 1)],
  },
  {
    hace: 22 * HORA, estado: 'pagado', pasos: { pagado: 7 * 60 * 1000 },
    cliente: { nombre: 'Ana', apellido: 'Pérez', dni: '30123456', celular: '5493364123456', email: 'ana.perez@ejemplo.com' },
    entrega: {
      tipo: 'envio_local',
      direccion: { calle: 'Av. Savio', numero: '123', pisoDepto: '2° B', ...SAN_NICOLAS, codigoPostal: 'B2900ABC' },
      notas: 'Tocar timbre 2B. Si no estoy, dejarlo en la casa de al lado (Marta).',
    },
    items: [item(1, 1), item(2, 1), item(5, 2)],
  },
  {
    hace: 3 * HORA, estado: 'pagado', pasos: { pagado: 3 * 60 * 1000 },
    cliente: { nombre: 'Matías', apellido: 'Sánchez', dni: '31777888', celular: '5493364776655', email: 'matias.sanchez@ejemplo.com' },
    entrega: { tipo: 'retiro' },
    items: [item(0, 1)],
  },
  {
    hace: 40 * 60 * 1000, estado: 'pendiente_pago', pasos: {},
    cliente: { nombre: 'Florencia', apellido: 'Díaz', dni: '44555777', celular: '5493364001122', email: 'flor.diaz@ejemplo.com' },
    entrega: { tipo: 'retiro' },
    items: [item(2, 1), item(4, 1)],
  },
]

const ahora = Date.now()
const fechaNota = (d) => d.toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' })
const pagoId = () => String(10_000_000_000 + Math.floor(Math.random() * 89_999_999_999))
let creados = 0

// Del más viejo al más nuevo, así los números quedan en orden de fecha
for (const prueba of PRUEBAS) {
  const numero = await siguienteNumero('pedido')
  const creado = new Date(ahora - prueba.hace)
  const subtotal = prueba.items.reduce((s, i) => s + i.precioUnitario * i.cantidad, 0)
  const costoEnvio = prueba.entrega.tipo === 'envio_local' ? COSTO_LOCAL : 0

  const historial = [{ estado: 'pendiente_pago', fecha: creado }]
  for (const [estado, despues] of Object.entries(prueba.pasos)) {
    historial.push({ estado, fecha: new Date(Math.min(creado.getTime() + despues, ahora - 60 * 1000)) })
  }
  const ultimo = historial.at(-1).fecha

  const cobrado = ['pagado', 'enviado', 'entregado'].includes(prueba.estado)
  const mp = { preferenciaId: `prueba-${numero}` }
  if (cobrado) Object.assign(mp, { pagoId: pagoId(), estadoPago: 'approved', detalle: 'accredited' })
  if (prueba.estadoPago) Object.assign(mp, { pagoId: pagoId(), estadoPago: prueba.estadoPago[0], detalle: prueba.estadoPago[1] })

  let notaInterna
  if (prueba.sobreventa !== undefined) {
    const i = prueba.items[0]
    // Como la escribe el webhook (anotar() en server/lib/pagos.js)
    notaInterna = `${fechaNota(historial[1].fecha)} — Sobreventa: ${i.nombre} (pedido #${String(numero).padStart(4, '0')}, había ${prueba.sobreventa})`
  }

  const pedido = new Pedido({
    numero,
    cliente: prueba.cliente,
    entrega: prueba.entrega,
    items: prueba.items,
    subtotal,
    costoEnvio,
    total: subtotal + costoEnvio,
    estado: prueba.estado,
    historial,
    seguimiento: prueba.seguimiento,
    notaInterna,
    mp,
    stockDescontado: cobrado,
    createdAt: creado,
    updatedAt: ultimo,
  })
  await pedido.save({ timestamps: false })
  creados++
  console.log(`  #${String(numero).padStart(4, '0')}  ${prueba.estado.padEnd(14)} ${prueba.entrega.tipo.padEnd(14)} ${prueba.cliente.nombre} ${prueba.cliente.apellido}`)
}

console.log(`Base ${m.connection.name}: ${creados} pedidos de prueba creados. El stock no se tocó.`)
await m.disconnect()
