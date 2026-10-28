import mongoose from 'mongoose'
import { conectarDB } from '../config/db.js'
import { obtenerPago } from './mercadopago.js'
import { sanityEscritura } from './sanity.js'
import Pedido from '../models/Pedido.js'

/** Estados en los que el pedido ya está cobrado. */
const ESTADOS_COBRADOS = ['pagado', 'enviado', 'entregado']
/** Reintentos del descuento de stock si otro cambio en Sanity se adelantó (cambió la revisión). */
const REINTENTOS_STOCK = 3

const nro = (n) => `#${String(n).padStart(4, '0')}`
const ignorado = (detalle, pedidoId = null) => ({ resultado: 'ignorado', detalle, pedidoId })
const procesado = (detalle, pedidoId) => ({ resultado: 'procesado', detalle, pedidoId })

const escaparRegex = (texto) => texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const hoy = () => new Date().toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' })

/**
 * Suma una línea a la nota interna del pedido, con la fecha. Si ese texto ya estaba, no lo repite
 * (Mercado Pago reenvía las notificaciones). Es atómico: dos notificaciones a la vez no se pisan.
 */
export async function anotar(pedidoId, texto) {
  const linea = `${hoy()} — ${texto}`
  await Pedido.updateOne(
    { _id: pedidoId, notaInterna: { $not: new RegExp(escaparRegex(texto)) } },
    [
      {
        $set: {
          notaInterna: {
            $cond: [
              { $gt: [{ $strLenCP: { $ifNull: ['$notaInterna', ''] } }, 0] },
              { $concat: ['$notaInterna', '\n', { $literal: linea }] },
              { $literal: linea },
            ],
          },
        },
      },
    ],
    { updatePipeline: true },
  )
}

const esTransaccionRepetida = (err) => err?.statusCode === 409 && /already exists/i.test(err?.message ?? '')
const esRevisionCambiada = (err) => err?.statusCode === 409 && /revision/i.test(err?.message ?? '')

/**
 * Descuenta del stock de Sanity las cantidades del pedido, en **una sola transacción** (todo o nada):
 * - cada producto se patchea con `ifRevisionID`: si alguien lo cambió entre la lectura y la escritura,
 *   la transacción falla y se vuelve a leer (hasta 3 reintentos);
 * - el `transactionId` es fijo por pedido y Sanity rechaza uno repetido: aunque dos notificaciones lo
 *   intenten a la vez, o se reintente después de un corte, el descuento se aplica una sola vez.
 * Devuelve `{ aplicado, notas }`: `aplicado: false` si ya lo había aplicado otra notificación (sin notas).
 */
async function descontarStock(pedido) {
  const cliente = sanityEscritura()
  const n = nro(pedido.numero)
  // Por producto (el checkout no deja ids repetidos, pero por las dudas se suman)
  const pedidos = new Map()
  for (const item of pedido.items) {
    const previo = pedidos.get(item.productoId)
    pedidos.set(item.productoId, { nombre: item.nombre, cantidad: (previo?.cantidad ?? 0) + item.cantidad })
  }
  const ids = [...pedidos.keys()]

  for (let intento = 0; ; intento++) {
    const docs = await cliente.fetch('*[_id in $ids]{ _id, _rev, nombre, stock }', { ids })
    const porId = new Map(docs.map((d) => [d._id, d]))
    const notas = []
    const transaccion = cliente.transaction()
    let cambios = 0

    for (const [id, { nombre, cantidad }] of pedidos) {
      const doc = porId.get(id)
      if (!doc) {
        notas.push(`Producto eliminado: ${nombre} (pedido ${n}). No se descontó su stock.`)
        continue
      }
      const stock = Number.isInteger(doc.stock) ? doc.stock : 0
      if (stock < cantidad) notas.push(`Sobreventa: ${doc.nombre ?? nombre} (pedido ${n}, había ${stock})`)
      transaccion.patch(id, (p) => p.ifRevisionId(doc._rev).set({ stock: Math.max(0, stock - cantidad) }))
      cambios++
    }

    if (cambios === 0) return { aplicado: true, notas }
    try {
      await transaccion.commit({ transactionId: `descuento-stock-${pedido._id}`, visibility: 'sync' })
      return { aplicado: true, notas }
    } catch (err) {
      // Ya lo había aplicado otra notificación (o un intento que se cortó antes de marcar el pedido)
      if (esTransaccionRepetida(err)) return { aplicado: false, notas: [] }
      if (esRevisionCambiada(err) && intento < REINTENTOS_STOCK) continue
      throw err
    }
  }
}

/** Descuenta el stock de un pedido ya pagado y lo marca con `stockDescontado: true`. */
async function completarDescuento(pedido) {
  const r = await descontarStock(pedido)
  for (const nota of r.notas) await anotar(pedido._id, nota)
  await Pedido.updateOne({ _id: pedido._id }, { $set: { stockDescontado: true } })
  return r
}

const conNotas = (texto, notas) => (notas.length ? `${texto} ${notas.join(' ')}` : texto)

/** `approved`: pasa el pedido de `pendiente_pago` a `pagado` (update atómico) y descuenta el stock. */
async function aprobar(pedido, pagoId, datosMp) {
  const n = nro(pedido.numero)
  const pedidoId = String(pedido._id)

  // Solo quien gana este update hace el cambio de estado; dos notificaciones a la vez no lo duplican
  const ganado = await Pedido.findOneAndUpdate(
    { _id: pedido._id, estado: 'pendiente_pago' },
    { $set: { ...datosMp, estado: 'pagado' }, $push: { historial: { estado: 'pagado', fecha: new Date() } } },
    { returnDocument: 'after' },
  )

  if (ganado) {
    const { aplicado, notas } = await completarDescuento(ganado)
    return procesado(conNotas(`Pedido ${n} pagado (pago ${pagoId}). ${aplicado ? 'Stock descontado.' : 'El stock ya estaba descontado.'}`, notas), pedidoId)
  }

  const actual = await Pedido.findById(pedido._id)
  if (!ESTADOS_COBRADOS.includes(actual.estado)) {
    await anotar(pedidoId, `Revisar: llegó el pago aprobado ${pagoId} pero el pedido estaba ${actual.estado}. No se cambió el estado.`)
    return ignorado(`Pago ${pagoId} aprobado para el pedido ${n}, que está ${actual.estado}: no se cambia`, pedidoId)
  }
  if (actual.stockDescontado) return ignorado(`El pedido ${n} ya estaba pagado y con el stock descontado`, pedidoId)

  // Pagado pero sin el descuento marcado: se cortó en el medio, o lo está haciendo otra notificación ahora.
  // La transacción de Sanity se aplica una sola vez, así que reintentarlo es seguro
  const { aplicado, notas } = await completarDescuento(actual)
  if (!aplicado) return ignorado(`El pedido ${n} ya estaba pagado y el stock ya estaba descontado`, pedidoId)
  return procesado(conNotas(`Pedido ${n} ya estaba pagado: se completó el descuento de stock.`, notas), pedidoId)
}

/**
 * Consulta un pago en Mercado Pago y actualiza su pedido. Lo usan el webhook y la reconciliación de
 * `GET /api/pedidos/:id/estado`. Si se pasa `pago` (ya consultado), no lo vuelve a pedir.
 * Devuelve `{ resultado: 'procesado' | 'ignorado', detalle, pedidoId }`. Si falla Mercado Pago,
 * Mongo o Sanity, tira el error (el webhook responde 500 y Mercado Pago reintenta).
 */
export async function procesarPago(pagoId, { pago } = {}) {
  if (!pago) {
    try {
      pago = await obtenerPago(pagoId)
    } catch (err) {
      // Un id que no existe (por ejemplo, la notificación de prueba del panel de Mercado Pago) no se reintenta
      if (err?.status === 404) return ignorado(`Mercado Pago no encuentra el pago ${pagoId}`)
      throw err
    }
  }

  const id = String(pago.id ?? pagoId)
  const ref = pago.external_reference
  if (!ref || !mongoose.isValidObjectId(ref)) return ignorado(`El pago ${id} no trae un external_reference de pedido`)

  await conectarDB()
  const pedido = await Pedido.findById(ref)
  if (!pedido) return ignorado(`No existe el pedido ${ref} del pago ${id}`)

  const pedidoId = String(pedido._id)
  const n = nro(pedido.numero)
  const { status } = pago
  const datosMp = { 'mp.pagoId': id, 'mp.estadoPago': status, 'mp.detalle': pago.status_detail ?? '' }

  // Ya cobrado con otro pago: un pago viejo (rechazado antes de aprobarse el bueno) no pisa los datos
  if (ESTADOS_COBRADOS.includes(pedido.estado) && pedido.mp?.pagoId && pedido.mp.pagoId !== id) {
    if (status === 'approved') {
      await anotar(pedidoId, `Revisar: llegó otro pago aprobado (${id}) y el pedido ya estaba pagado con el ${pedido.mp.pagoId}. Puede ser un cobro doble.`)
    }
    return ignorado(`El pedido ${n} ya está pagado con el pago ${pedido.mp.pagoId}; el ${id} (${status}) no lo cambia`, pedidoId)
  }

  // Monto y moneda: si no coinciden con el pedido, no se marca pagado
  if (Number(pago.transaction_amount) !== pedido.total || pago.currency_id !== 'ARS') {
    const motivo = `El monto pagado no coincide: ${pago.transaction_amount} ${pago.currency_id} y el pedido es de ${pedido.total} ARS`
    await Pedido.updateOne({ _id: pedido._id }, { $set: { ...datosMp, 'mp.detalle': `${pago.status_detail ?? status}. ${motivo}` } })
    await anotar(pedidoId, `Revisar: el monto pagado no coincide (pago ${id}: ${pago.transaction_amount} ${pago.currency_id}; total ${pedido.total} ARS).`)
    return ignorado(motivo, pedidoId)
  }

  if (status === 'approved') return aprobar(pedido, id, datosMp)

  // rejected, cancelled, in_process, pending…: se guarda el pago y el estado no cambia
  // (con un rechazo, el comprador puede reintentar con otra tarjeta en la misma preferencia)
  await Pedido.updateOne({ _id: pedido._id }, { $set: datosMp })
  if (status === 'refunded' || status === 'charged_back') {
    const que = status === 'refunded' ? 'se devolvió (refunded)' : 'tuvo un contracargo (charged_back)'
    await anotar(pedidoId, `Revisar: el pago ${id} ${que}. El estado del pedido no se cambió.`)
  }
  return procesado(`Pago ${id} ${status} (${pago.status_detail ?? 'sin detalle'}). El pedido ${n} sigue ${pedido.estado}`, pedidoId)
}
