import crypto from 'node:crypto'
import { MercadoPagoConfig, Payment, Preference } from 'mercadopago'
import { requerirEnv } from '../config/env.js'

// Se crean en el primer uso, como los clientes de Sanity: si falta el token, falla el request que lo necesita
let config = null
let preferencias = null
let pagos = null

function configMp() {
  config ??= new MercadoPagoConfig({ accessToken: requerirEnv('MP_ACCESS_TOKEN'), options: { timeout: 10000 } })
  return config
}

function clientePreferencias() {
  preferencias ??= new Preference(configMp())
  return preferencias
}

// La consulta de un pago se puede reemplazar (solo en scripts de prueba) para simular Mercado Pago
let consultaPago = (id) => {
  pagos ??= new Payment(configMp())
  return pagos.get({ id })
}

/** El pago tal como lo devuelve `GET /v1/payments/:id`. Si no existe, el error trae `status: 404`. */
export function obtenerPago(id) {
  return consultaPago(id)
}

/** Solo para pruebas: reemplaza la consulta del pago por una función `(id) => Promise<pago>`. */
export function reemplazarConsultaPago(fn) {
  consultaPago = fn
}

/** `TEST-`, `APP_USR-` u `otro`: solo el prefijo del token, nunca el resto. */
export function prefijoToken(token = process.env.MP_ACCESS_TOKEN) {
  const t = token?.trim() ?? ''
  if (t.startsWith('TEST-')) return 'TEST-'
  if (t.startsWith('APP_USR-')) return 'APP_USR-'
  return 'otro'
}

/**
 * Para `/api/health`: consulta `GET /users/me` con el token (timeout de 3 s).
 * Devuelve `{ mp: 'ok' | 'error' | 'sin_configurar', error? }`, sin el token en ningún lado.
 * En el log del server (no en la respuesta) deja el prefijo del token y si la cuenta es de prueba.
 */
export async function diagnosticoMp() {
  const token = process.env.MP_ACCESS_TOKEN?.trim()
  if (!token) return { mp: 'sin_configurar' }
  try {
    const r = await fetch('https://api.mercadopago.com/users/me', {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(3000),
    })
    if (!r.ok) {
      const cuerpo = await r.json().catch(() => ({}))
      const motivo = `Mercado Pago respondió ${r.status}${cuerpo?.message ? `: ${cuerpo.message}` : ''}`
      console.error(`Health: ${motivo} (token ${prefijoToken(token)}…)`)
      return { mp: 'error', error: motivo.replaceAll(token, '<token>') }
    }
    const yo = await r.json()
    const tags = Array.isArray(yo.tags) ? yo.tags : []
    const usuarioDePrueba = tags.includes('test_user') || /^TESTUSER/i.test(yo.nickname ?? '') || yo.test_user === true
    console.log(
      `Health: Mercado Pago ok. Token ${prefijoToken(token)}…; usuario ${usuarioDePrueba ? 'DE PRUEBA' : 'real'}` +
        ` (site ${yo.site_id ?? '?'}, tags: ${tags.join(', ') || 'ninguno'})`,
    )
    return { mp: 'ok' }
  } catch (err) {
    const motivo = err?.name === 'TimeoutError' ? 'Mercado Pago no respondió a tiempo' : `No se pudo consultar Mercado Pago: ${err?.message ?? err}`
    console.error(`Health: ${motivo}`)
    return { mp: 'error', error: motivo.replaceAll(token, '<token>') }
  }
}

/** Un link de pago abandonado no sirve para pagar días después. */
const VENCIMIENTO_HORAS = 24

/**
 * Fecha ISO con la hora de Argentina (UTC−3, sin horario de verano): `2026-10-28T15:04:05.000-03:00`.
 * Es el formato que muestra la documentación de Mercado Pago para `expiration_date_to`.
 */
export function fechaMp(fecha) {
  const local = new Date(fecha.getTime() - 3 * 60 * 60 * 1000)
  return local.toISOString().replace('Z', '-03:00')
}

/** `SITE_URL` sin la `/` del final. */
function sitio() {
  return requerirEnv('SITE_URL').replace(/\/+$/, '')
}

/** Imagen del ítem en el checkout de Mercado Pago: la portada a 400px, en JPEG. */
const imagenMp = (url) => (url ? `${url}?w=400&h=400&fit=max&fm=jpg&q=80` : undefined)

/** El cuerpo de la preferencia de Checkout Pro para un pedido ya creado (con `_id`). */
export function cuerpoPreferencia(pedido, { autoReturn } = {}) {
  const base = sitio()
  const https = base.startsWith('https://')
  const id = String(pedido._id)

  const items = pedido.items.map((i) => ({
    id: i.productoId,
    title: i.nombre,
    quantity: i.cantidad,
    unit_price: i.precioUnitario,
    currency_id: 'ARS',
    picture_url: imagenMp(i.imagenUrl),
  }))
  if (pedido.costoEnvio > 0) {
    items.push({ id: 'envio', title: 'Envío en San Nicolás', quantity: 1, unit_price: pedido.costoEnvio, currency_id: 'ARS' })
  }

  return {
    items,
    payer: {
      name: pedido.cliente.nombre,
      surname: pedido.cliente.apellido,
      email: pedido.cliente.email,
      identification: { type: 'DNI', number: pedido.cliente.dni },
    },
    external_reference: id,
    back_urls: {
      success: `${base}/pago/exito?pedido=${id}`,
      failure: `${base}/pago/error?pedido=${id}`,
      pending: `${base}/pago/pendiente?pedido=${id}`,
    },
    ...((autoReturn ?? true) && { auto_return: 'approved' }),
    // Mercado Pago no llega a localhost: el webhook solo se avisa con una URL pública.
    // `source_news=webhooks` pide solo notificaciones Webhook (firmadas) y no las IPN viejas, que no traen firma
    ...(https && { notification_url: `${base}/api/pagos/webhook?source_news=webhooks` }),
    statement_descriptor: 'MUNDO MICKEY',
    expires: true,
    expiration_date_to: fechaMp(new Date(Date.now() + VENCIMIENTO_HORAS * 60 * 60 * 1000)),
    // Sin efectivo (Rapipago, Pago Fácil, cajeros): se acredita días después y, con poco stock,
    // el producto puede estar vendido para entonces
    payment_methods: { excluded_payment_types: [{ id: 'ticket' }, { id: 'atm' }] },
  }
}

/** Mercado Pago rechazó `auto_return` (pasa con `back_urls` que no son públicas, como las de localhost). */
function rechazoAutoReturn(err) {
  const texto = `${err?.message ?? ''} ${JSON.stringify(err?.cause ?? err?.errorResponse ?? '')}`
  return /auto_return|back_url/i.test(texto)
}

/**
 * Crea la preferencia del pedido y devuelve `{ id, init_point }`.
 * Si `SITE_URL` no es https y Mercado Pago rechaza `auto_return`, la vuelve a crear sin él.
 */
export async function crearPreferencia(pedido) {
  const cliente = clientePreferencias()
  let respuesta
  try {
    respuesta = await cliente.create({ body: cuerpoPreferencia(pedido) })
  } catch (err) {
    if (sitio().startsWith('https://') || !rechazoAutoReturn(err)) throw err
    console.warn('Mercado Pago rechazó auto_return con SITE_URL sin https: se crea la preferencia sin él.')
    respuesta = await cliente.create({ body: cuerpoPreferencia(pedido, { autoReturn: false }) })
  }
  return { id: respuesta.id, init_point: respuesta.init_point }
}

/**
 * Valida el header `x-signature` (`ts=…,v1=…`) de una notificación Webhook de Mercado Pago.
 * Manifiesto: `id:<data.id>;request-id:<x-request-id>;ts:<ts>;`, con `data.id` del query string
 * (en minúsculas si es alfanumérico). Si falta `data.id` o `x-request-id`, su par se omite (regla de la
 * documentación, la misma del `WebhookSignatureValidator` del SDK). HMAC-SHA256 en hex con la clave secreta
 * y comparación en tiempo constante.
 */
export function firmaValida({ xSignature, xRequestId, dataId, secreto }) {
  if (typeof xSignature !== 'string' || !secreto) return false
  const partes = {}
  for (const parte of xSignature.split(',')) {
    const igual = parte.indexOf('=')
    if (igual > 0) partes[parte.slice(0, igual).trim().toLowerCase()] = parte.slice(igual + 1).trim()
  }
  const { ts, v1 } = partes
  if (!ts || !/^\d+$/.test(ts) || !v1 || !/^[0-9a-f]{64}$/i.test(v1)) return false

  const id = typeof dataId === 'string' && dataId.trim() ? dataId.trim() : ''
  const requestId = typeof xRequestId === 'string' && xRequestId.trim() ? xRequestId.trim() : ''
  const manifiesto =
    (id ? `id:${/^[a-z0-9]+$/i.test(id) ? id.toLowerCase() : id};` : '') +
    (requestId ? `request-id:${requestId};` : '') +
    `ts:${ts};`

  const esperada = crypto.createHmac('sha256', secreto).update(manifiesto).digest()
  return crypto.timingSafeEqual(esperada, Buffer.from(v1, 'hex'))
}
