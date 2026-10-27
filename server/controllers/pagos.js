import { conectarDB } from '../config/db.js'
import { sanityLectura } from '../lib/sanity.js'
import { armarMontos, problemasDeStock, validarCheckout } from '../lib/checkout.js'
import { crearPreferencia } from '../lib/mercadopago.js'
import { siguienteNumero } from '../models/Counter.js'
import Pedido from '../models/Pedido.js'

const MENSAJE_MP = 'No pudimos conectar con Mercado Pago. Probá de nuevo en unos minutos.'

/** Configuración y productos pedidos, sin CDN: precios y stock reales. */
async function leerSanity(ids) {
  const cliente = sanityLectura()
  const [configuracion, productos] = await Promise.all([
    cliente.fetch('*[_id == "configuracion"][0]{ envioLocal, envioNacional }'),
    ids.length
      ? cliente.fetch(
          '*[_type == "producto" && _id in $ids]{ _id, nombre, precio, stock, activo, "imagenUrl": imagenes[0].asset->url }',
          { ids },
        )
      : [],
  ])
  return { configuracion, productos }
}

/**
 * POST /api/pagos/checkout: `{ items: [{ id, cantidad }], cliente, entrega }`, sin precios.
 * Valida, crea el pedido en `pendiente_pago` y la preferencia de Checkout Pro. Responde 201 `{ pedidoId, numero, initPoint }`.
 */
export async function checkout(req, res) {
  const items = Array.isArray(req.body?.items) ? req.body.items : []
  // Hasta 20 (el máximo): con más, la validación responde 400 igual
  const ids = items.slice(0, 20).map((i) => i?.id).filter((id) => typeof id === 'string')
  const { configuracion, productos } = await leerSanity(ids)

  // 1. Validar todo antes de crear nada
  const { datos, campos } = validarCheckout(req.body, configuracion)
  if (campos) return res.status(400).json({ error: 'Revisá los datos del pedido.', campos })

  const problemas = problemasDeStock(datos.items, productos)
  if (problemas.length) return res.status(409).json({ error: 'Algunos productos cambiaron.', items: problemas })

  if (!process.env.MP_ACCESS_TOKEN?.trim()) {
    console.error('Checkout: falta la variable de entorno MP_ACCESS_TOKEN')
    return res.status(500).json({ error: 'Falta configurar Mercado Pago.' })
  }

  const montos = armarMontos(datos.items, productos, datos.entrega, configuracion)

  // 2 y 3. Número correlativo y pedido en pendiente_pago
  await conectarDB()
  const numero = await siguienteNumero('pedido')
  const pedido = await Pedido.create({
    numero,
    cliente: datos.cliente,
    entrega: datos.entrega,
    ...montos,
    estado: 'pendiente_pago',
    historial: [{ estado: 'pendiente_pago', fecha: new Date() }],
  })

  // 4. Preferencia. Si Mercado Pago falla, el pedido se cancela y su número queda salteado
  let preferencia
  try {
    preferencia = await crearPreferencia(pedido)
  } catch (err) {
    const detalle = `No se pudo crear la preferencia: ${err?.message ?? err}`
    console.error(`Checkout: pedido #${numero}. ${detalle}`)
    await Pedido.updateOne(
      { _id: pedido._id },
      { $set: { estado: 'cancelado', 'mp.detalle': detalle.slice(0, 500) }, $push: { historial: { estado: 'cancelado', fecha: new Date() } } },
    )
    return res.status(502).json({ error: MENSAJE_MP })
  }

  // 5 y 6
  await Pedido.updateOne({ _id: pedido._id }, { $set: { 'mp.preferenciaId': preferencia.id } })
  res.status(201).json({ pedidoId: String(pedido._id), numero, initPoint: preferencia.init_point })
}
