// Reglas del checkout: validación del cuerpo de POST /api/pagos/checkout y armado de los montos.

/** Las 24 jurisdicciones, como las muestra el select del front (src/lib/provincias.ts). */
export const PROVINCIAS = [
  'Buenos Aires',
  'Ciudad Autónoma de Buenos Aires',
  'Catamarca',
  'Chaco',
  'Chubut',
  'Córdoba',
  'Corrientes',
  'Entre Ríos',
  'Formosa',
  'Jujuy',
  'La Pampa',
  'La Rioja',
  'Mendoza',
  'Misiones',
  'Neuquén',
  'Río Negro',
  'Salta',
  'San Juan',
  'San Luis',
  'Santa Cruz',
  'Santa Fe',
  'Santiago del Estero',
  'Tierra del Fuego',
  'Tucumán',
]

/** El envío en San Nicolás no pide localidad ni provincia: se completan solas. */
export const LOCALIDAD_LOCAL = { localidad: 'San Nicolás de los Arroyos', provincia: 'Buenos Aires' }

const MAX_ITEMS = 20
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
// 4 dígitos (2900) o CPA: letra de la provincia + 4 dígitos + 3 letras (B2900ABC)
const CODIGO_POSTAL = /^(\d{4}|[A-Z]\d{4}[A-Z]{3})$/

const esObjeto = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)

/**
 * Un texto obligatorio u opcional, sin espacios al principio ni al final, de `min` a `max` caracteres.
 * Devuelve el texto (o '' si es opcional y no vino), o `undefined` si cargó un error en `campos[clave]`.
 */
function texto(valor, clave, campos, { nombre, min = 1, max, opcional = false }) {
  if (valor === undefined || valor === null || (typeof valor === 'string' && !valor.trim())) {
    if (opcional) return ''
    campos[clave] = `${nombre} es obligatorio.`
    return undefined
  }
  if (typeof valor !== 'string') {
    campos[clave] = `${nombre} tiene que ser un texto.`
    return undefined
  }
  const limpio = valor.replace(/\r\n/g, '\n').trim()
  if (limpio.length < min || limpio.length > max) {
    campos[clave] = min > 1 ? `${nombre} tiene que tener entre ${min} y ${max} caracteres.` : `${nombre} puede tener hasta ${max} caracteres.`
    return undefined
  }
  return limpio
}

function validarItems(items, campos) {
  if (!Array.isArray(items) || items.length === 0) {
    campos.items = 'El carrito está vacío.'
    return undefined
  }
  if (items.length > MAX_ITEMS) {
    campos.items = `El pedido puede tener hasta ${MAX_ITEMS} productos distintos.`
    return undefined
  }
  const vistos = new Set()
  const limpios = []
  for (const item of items) {
    // Solo id y cantidad: si viene un precio, se ignora
    const id = esObjeto(item) && typeof item.id === 'string' ? item.id.trim() : ''
    if (!id || !Number.isInteger(item.cantidad) || item.cantidad < 1) {
      campos.items = 'Alguno de los productos del carrito no es válido.'
      return undefined
    }
    if (vistos.has(id)) {
      campos.items = 'Hay un producto repetido en el carrito.'
      return undefined
    }
    vistos.add(id)
    limpios.push({ id, cantidad: item.cantidad })
  }
  return limpios
}

function validarCliente(c, campos) {
  const b = esObjeto(c) ? c : {}
  const cliente = {}

  cliente.nombre = texto(b.nombre, 'cliente.nombre', campos, { nombre: 'El nombre', min: 2, max: 60 })
  cliente.apellido = texto(b.apellido, 'cliente.apellido', campos, { nombre: 'El apellido', min: 2, max: 60 })

  // Se aceptan puntos y espacios (30.123.456); se guardan solo los dígitos
  if (typeof b.dni !== 'string' && typeof b.dni !== 'number') {
    campos['cliente.dni'] = 'El DNI es obligatorio.'
  } else {
    const dni = String(b.dni).replace(/[.\s]/g, '')
    if (!dni) campos['cliente.dni'] = 'El DNI es obligatorio.'
    else if (!/^\d{7,8}$/.test(dni)) campos['cliente.dni'] = 'El DNI tiene que tener 7 u 8 números.'
    else cliente.dni = dni
  }

  // Los dígitos de después del +54 9: código de área sin 0 y número sin 15
  if (typeof b.celular !== 'string' || !b.celular.trim()) {
    campos['cliente.celular'] = 'El celular es obligatorio.'
  } else {
    const digitos = b.celular.replace(/[\s()-]/g, '')
    if (!/^\d{10}$/.test(digitos)) {
      campos['cliente.celular'] = 'El celular tiene que tener 10 números: el código de área sin el 0 y el número sin el 15.'
    } else {
      cliente.celular = `549${digitos}`
    }
  }

  const email = texto(b.email, 'cliente.email', campos, { nombre: 'El email', max: 120 })
  if (email !== undefined) {
    if (!EMAIL.test(email)) campos['cliente.email'] = 'Revisá el email: tiene que ser como nombre@ejemplo.com.'
    else cliente.email = email.toLowerCase()
  }

  return cliente
}

function validarDireccion(d, tipo, campos) {
  const b = esObjeto(d) ? d : {}
  const clave = (c) => `entrega.direccion.${c}`
  const direccion = {}

  direccion.calle = texto(b.calle, clave('calle'), campos, { nombre: 'La calle', min: 2, max: 80 })
  direccion.numero = texto(b.numero, clave('numero'), campos, { nombre: 'El número', max: 10 })
  const pisoDepto = texto(b.pisoDepto, clave('pisoDepto'), campos, { nombre: 'El piso o depto', max: 20, opcional: true })
  if (pisoDepto) direccion.pisoDepto = pisoDepto

  if (tipo === 'envio_local') {
    Object.assign(direccion, LOCALIDAD_LOCAL)
  } else {
    direccion.localidad = texto(b.localidad, clave('localidad'), campos, { nombre: 'La localidad', min: 2, max: 80 })
    if (typeof b.provincia !== 'string' || !b.provincia.trim()) campos[clave('provincia')] = 'Elegí la provincia.'
    else if (!PROVINCIAS.includes(b.provincia.trim())) campos[clave('provincia')] = 'Elegí una provincia de la lista.'
    else direccion.provincia = b.provincia.trim()
  }

  const cp = texto(b.codigoPostal, clave('codigoPostal'), campos, { nombre: 'El código postal', max: 8 })
  if (cp !== undefined) {
    const normalizado = cp.replace(/\s/g, '').toUpperCase()
    if (!CODIGO_POSTAL.test(normalizado)) {
      campos[clave('codigoPostal')] = 'El código postal tiene que tener 4 números (2900) o ser como B2900ABC.'
    } else {
      direccion.codigoPostal = normalizado
    }
  }

  return direccion
}

/**
 * Valida el cuerpo del checkout contra la configuración (sin CDN). Ignora cualquier campo que no sea
 * del pedido, incluidos los precios. Devuelve `{ datos }` o `{ campos }`, con claves como `cliente.dni`
 * o `entrega.direccion.calle`.
 */
export function validarCheckout(cuerpo, configuracion) {
  const b = esObjeto(cuerpo) ? cuerpo : {}
  const campos = {}

  const items = validarItems(b.items, campos)
  const cliente = validarCliente(b.cliente, campos)

  const e = esObjeto(b.entrega) ? b.entrega : {}
  const entrega = {}
  const habilitado = {
    retiro: true, // siempre disponible
    envio_local: configuracion?.envioLocal?.habilitado === true,
    envio_nacional: configuracion?.envioNacional?.habilitado === true,
  }
  if (!(e.tipo in habilitado)) {
    campos['entrega.tipo'] = 'Elegí cómo querés recibir el pedido.'
  } else if (!habilitado[e.tipo]) {
    campos['entrega.tipo'] = 'Esa forma de entrega no está disponible. Elegí otra.'
  } else {
    entrega.tipo = e.tipo
    // Con retiro, la dirección se ignora
    if (e.tipo !== 'retiro') entrega.direccion = validarDireccion(e.direccion, e.tipo, campos)
  }
  const notas = texto(e.notas, 'entrega.notas', campos, { nombre: 'El texto de las notas', max: 300, opcional: true })
  if (notas) entrega.notas = notas

  return Object.keys(campos).length ? { campos } : { datos: { items, cliente, entrega } }
}

/**
 * Compara lo pedido con los productos de Sanity. Devuelve los problemas por ítem (vacío si está todo bien).
 * `productos` es lo que devolvió la query, con `_id`, `activo` y `stock`.
 */
export function problemasDeStock(items, productos) {
  const porId = new Map(productos.map((p) => [p._id, p]))
  const problemas = []
  for (const { id, cantidad } of items) {
    const p = porId.get(id)
    if (!p || p.activo !== true) problemas.push({ id, motivo: 'no_disponible', stockDisponible: 0 })
    else if (!Number.isInteger(p.stock) || p.stock < cantidad) problemas.push({ id, motivo: 'sin_stock', stockDisponible: Math.max(0, p.stock ?? 0) })
  }
  return problemas
}

/** Ítems del pedido con los datos de Sanity, y los montos. `envio_nacional` no se cobra en la web. */
export function armarMontos(items, productos, entrega, configuracion) {
  const porId = new Map(productos.map((p) => [p._id, p]))
  const lineas = items.map(({ id, cantidad }) => {
    const p = porId.get(id)
    return { productoId: id, nombre: p.nombre, precioUnitario: p.precio, cantidad, imagenUrl: p.imagenUrl ?? undefined }
  })
  const subtotal = lineas.reduce((suma, l) => suma + l.precioUnitario * l.cantidad, 0)
  const costoEnvio = entrega.tipo === 'envio_local' ? (configuracion.envioLocal.costo ?? 0) : 0
  return { items: lineas, subtotal, costoEnvio, total: subtotal + costoEnvio }
}
