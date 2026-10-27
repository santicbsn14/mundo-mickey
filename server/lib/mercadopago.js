import { MercadoPagoConfig, Preference } from 'mercadopago'
import { requerirEnv } from '../config/env.js'

// Se crea en el primer uso, como los clientes de Sanity: si falta el token, falla el request que lo necesita
let preferencias = null

function clientePreferencias() {
  preferencias ??= new Preference(
    new MercadoPagoConfig({ accessToken: requerirEnv('MP_ACCESS_TOKEN'), options: { timeout: 10000 } }),
  )
  return preferencias
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
    // Mercado Pago no llega a localhost: el webhook (brief 09) solo se avisa con una URL pública
    ...(https && { notification_url: `${base}/api/pagos/webhook` }),
    statement_descriptor: 'MUNDO MICKEY',
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
