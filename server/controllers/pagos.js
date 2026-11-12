import { conectarDB } from '../config/db.js'
import { sanityLectura } from '../lib/sanity.js'
import { armarMontos, problemasDeStock, validarCheckout } from '../lib/checkout.js'
import { crearPreferencia, firmaValida } from '../lib/mercadopago.js'
import { procesarPago } from '../lib/pagos.js'
import { siguienteNumero } from '../models/Counter.js'
import EventoWebhook from '../models/EventoWebhook.js'
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

const texto = (v) => (typeof v === 'string' ? v : Array.isArray(v) && typeof v[0] === 'string' ? v[0] : undefined)

/** Guarda la notificación y su resultado. Si Mongo falla, solo lo deja en la consola: no cambia la respuesta. */
async function registrarEvento(evento, inicio) {
  try {
    await conectarDB()
    await EventoWebhook.create({ ...evento, duracionMs: Date.now() - inicio })
  } catch (err) {
    console.error('Webhook: no se pudo guardar el EventoWebhook:', err?.message ?? err, evento)
  }
}

/**
 * POST /api/pagos/webhook: notificaciones de Mercado Pago.
 * Valida la firma, consulta el pago y actualiza el pedido, **y recién después responde**: en serverless
 * no hay garantía de ejecutar nada después de la respuesta. 200 si se procesó o se ignoró; 401 con firma
 * inválida; 500 si falló Mercado Pago, Mongo o Sanity, para que Mercado Pago reintente.
 */
export async function webhook(req, res) {
  const inicio = Date.now()
  const { query } = req
  const body = req.body && typeof req.body === 'object' ? req.body : {}
  const tipo = texto(query.type) ?? texto(query.topic) ?? texto(body.type) ?? texto(body.topic)
  const dataId = texto(query['data.id'])
  const evento = {
    recibidoEn: new Date(inicio),
    query: req.originalUrl.split('?')[1] ?? '',
    body: JSON.stringify(body).slice(0, 4096),
    requestId: texto(req.get('x-request-id')),
    tipo,
    pagoId: dataId ?? (body.data?.id != null ? String(body.data.id) : undefined),
  }

  const secreto = process.env.MP_WEBHOOK_SECRET?.trim()
  if (!secreto) {
    // Falta configurarlo: 500 para que Mercado Pago reintente cuando esté la clave
    console.error('Webhook: falta la variable de entorno MP_WEBHOOK_SECRET')
    await registrarEvento({ ...evento, resultado: 'error', detalle: 'Falta la variable de entorno MP_WEBHOOK_SECRET' }, inicio)
    return res.status(500).json({ error: 'Webhook sin configurar.' })
  }

  evento.firmaValida = firmaValida({ xSignature: req.get('x-signature'), xRequestId: evento.requestId, dataId, secreto })
  if (!evento.firmaValida) {
    await registrarEvento({ ...evento, firma: texto(req.get('x-signature'))?.slice(0, 200), resultado: 'firma_invalida', detalle: req.get('x-signature') ? 'La firma no coincide' : 'Sin x-signature' }, inicio)
    return res.status(401).json({ error: 'Firma inválida.' })
  }

  if (tipo !== 'payment') {
    await registrarEvento({ ...evento, resultado: 'ignorado', detalle: `Tipo ${tipo ?? '(sin tipo)'}: solo se procesan pagos` }, inicio)
    return res.json({ ok: true, resultado: 'ignorado' })
  }
  if (!dataId || !/^\d+$/.test(dataId)) {
    await registrarEvento({ ...evento, resultado: 'ignorado', detalle: 'Sin data.id numérico en el query string' }, inicio)
    return res.json({ ok: true, resultado: 'ignorado' })
  }

  try {
    const r = await procesarPago(dataId)
    await registrarEvento({ ...evento, resultado: r.resultado, detalle: r.detalle, pedidoId: r.pedidoId ?? undefined }, inicio)
    res.json({ ok: true, resultado: r.resultado })
  } catch (err) {
    const detalle = `${err?.message ?? err}`.slice(0, 1000)
    console.error(`Webhook: error al procesar el pago ${dataId}:`, err)
    await registrarEvento({ ...evento, resultado: 'error', detalle }, inicio)
    res.status(500).json({ error: 'No se pudo procesar la notificación.' })
  }
}
