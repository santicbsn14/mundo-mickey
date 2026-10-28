import mongoose from 'mongoose'
import { conectarDB } from '../config/db.js'
import { obtenerPago } from '../lib/mercadopago.js'
import { procesarPago } from '../lib/pagos.js'
import Pedido from '../models/Pedido.js'

const NO_ENCONTRADO = { error: 'No encontramos el pedido.' }

/** Lo único público de un pedido: nada de datos personales ni montos. */
const estadoPublico = (p) => ({ numero: p.numero, estado: p.estado, tipoEntrega: p.entrega.tipo })

/**
 * Reconciliación por la vuelta de Mercado Pago: si el pedido sigue pendiente y la URL trae el pago,
 * lo consulta y lo procesa como el webhook, **solo si ese pago es de este pedido**. Así la página de
 * éxito confirma el pago aunque el webhook no haya llegado. Si falla, se responde el estado que había.
 */
async function reconciliar(pedido, pagoId) {
  try {
    const pago = await obtenerPago(pagoId)
    if (pago?.external_reference !== String(pedido._id)) return false
    const r = await procesarPago(pagoId, { pago })
    console.log(`Estado del pedido #${pedido.numero}: reconciliación con el pago ${pagoId} → ${r.resultado}. ${r.detalle}`)
    return true
  } catch (err) {
    if (err?.status !== 404) console.error(`Estado del pedido #${pedido.numero}: no se pudo reconciliar el pago ${pagoId}:`, err?.message ?? err)
    return false
  }
}

/** GET /api/pedidos/:id/estado[?pago=<payment_id>] → `{ numero, estado, tipoEntrega }`. */
export async function estado(req, res) {
  const { id } = req.params
  if (!mongoose.isValidObjectId(id) || !/^[0-9a-f]{24}$/i.test(id)) return res.status(404).json(NO_ENCONTRADO)

  await conectarDB()
  const campos = 'numero estado entrega.tipo'
  let pedido = await Pedido.findById(id, campos).lean()
  if (!pedido) return res.status(404).json(NO_ENCONTRADO)

  const pago = typeof req.query.pago === 'string' ? req.query.pago.trim() : ''
  if (pedido.estado === 'pendiente_pago' && /^\d{1,20}$/.test(pago) && process.env.MP_ACCESS_TOKEN?.trim()) {
    if (await reconciliar(pedido, pago)) pedido = (await Pedido.findById(id, campos).lean()) ?? pedido
  }

  res.set('Cache-Control', 'no-store')
  res.json(estadoPublico(pedido))
}
