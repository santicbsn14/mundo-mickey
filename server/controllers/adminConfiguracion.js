import { sanityEscritura, sanityLectura } from '../lib/sanity.js'

const ID = 'configuracion'

/** Lo que devuelve el GET si todavía no hay documento. También completa los campos que falten. */
const POR_DEFECTO = {
  whatsapp: '',
  instagram: '',
  direccion: '',
  horarios: '',
  mapaUrl: '',
  envioLocal: { habilitado: false, costo: 0, texto: '' },
  envioNacional: { habilitado: false, texto: '' },
  marquesina: [],
}

const MAX_COSTO = 1_000_000
const MAX_MARQUESINA = 10

// Formato de wa.me para Argentina: 549 + código de área (sin 0) + número (sin 15)
const WHATSAPP = /^549\d{9,10}$/
const INSTAGRAM = /^[A-Za-z0-9._]{1,30}$/
// Links de Google Maps que se aceptan: host → prefijo del camino ('' = cualquiera)
const HOSTS_MAPA = {
  'google.com': '/maps',
  'www.google.com': '/maps',
  'maps.google.com': '',
  'goo.gl': '/maps',
  'maps.app.goo.gl': '',
}

function esLinkDeMapa(texto) {
  let url
  try {
    url = new URL(texto)
  } catch {
    return false
  }
  const prefijo = HOSTS_MAPA[url.hostname.toLowerCase()]
  if (url.protocol !== 'https:' || prefijo === undefined || url.username || url.password) return false
  return url.pathname === prefijo || url.pathname.startsWith(`${prefijo}/`)
}

/** La configuración guardada con todos los campos del modelo (los que falten, con su valor por defecto). */
function completar(doc) {
  const d = doc ?? {}
  return {
    whatsapp: d.whatsapp ?? POR_DEFECTO.whatsapp,
    instagram: d.instagram ?? POR_DEFECTO.instagram,
    direccion: d.direccion ?? POR_DEFECTO.direccion,
    horarios: d.horarios ?? POR_DEFECTO.horarios,
    mapaUrl: d.mapaUrl ?? POR_DEFECTO.mapaUrl,
    envioLocal: { ...POR_DEFECTO.envioLocal, ...d.envioLocal },
    envioNacional: { ...POR_DEFECTO.envioNacional, ...d.envioNacional },
    marquesina: d.marquesina ?? POR_DEFECTO.marquesina,
  }
}

async function leer() {
  const doc = await sanityLectura().fetch(
    `*[_id == $id][0]{ whatsapp, instagram, direccion, horarios, mapaUrl, envioLocal, envioNacional, marquesina }`,
    { id: ID },
  )
  return completar(doc)
}

/**
 * Un texto opcional: sin espacios al principio ni al final y con `max` caracteres como máximo.
 * Ausente o `null` → ''. Devuelve el texto, o `undefined` si cargó un error en `campos[clave]`.
 */
function texto(valor, clave, max, campos, nombre) {
  if (valor === undefined || valor === null) return ''
  if (typeof valor !== 'string') {
    campos[clave] = `${nombre} tiene que ser un texto.`
    return undefined
  }
  const limpio = valor.replace(/\r\n/g, '\n').trim()
  if (limpio.length > max) {
    campos[clave] = `${nombre} puede tener hasta ${max} caracteres.`
    return undefined
  }
  return limpio
}

/**
 * Valida el cuerpo del PUT e ignora cualquier campo que no sea del modelo.
 * Devuelve `{ datos }` o `{ campos }`, con claves como `envioLocal.costo` o `marquesina.2`.
 */
function validarConfiguracion(cuerpo) {
  const b = cuerpo && typeof cuerpo === 'object' && !Array.isArray(cuerpo) ? cuerpo : {}
  const campos = {}
  const datos = {}

  datos.whatsapp = texto(b.whatsapp, 'whatsapp', 20, campos, 'El WhatsApp')
  if (datos.whatsapp && !WHATSAPP.test(datos.whatsapp)) {
    campos.whatsapp = 'El WhatsApp tiene que tener solo números: 549, el código de área sin el 0 y el número sin el 15 (12 o 13 dígitos en total).'
  }

  datos.instagram = texto(b.instagram, 'instagram', 30, campos, 'El usuario de Instagram')
  if (datos.instagram && !INSTAGRAM.test(datos.instagram)) {
    campos.instagram = 'El usuario de Instagram solo puede tener letras, números, puntos y guiones bajos (sin @ ni espacios).'
  }

  datos.direccion = texto(b.direccion, 'direccion', 120, campos, 'La dirección')
  datos.horarios = texto(b.horarios, 'horarios', 300, campos, 'El texto de los horarios')

  datos.mapaUrl = texto(b.mapaUrl, 'mapaUrl', 500, campos, 'El link de Google Maps')
  if (datos.mapaUrl && !esLinkDeMapa(datos.mapaUrl)) {
    campos.mapaUrl = 'Tiene que ser un link de Google Maps (empieza con https://maps.app.goo.gl/ o https://www.google.com/maps/).'
  }

  const local = b.envioLocal && typeof b.envioLocal === 'object' ? b.envioLocal : {}
  datos.envioLocal = {}
  if (typeof local.habilitado !== 'boolean') campos['envioLocal.habilitado'] = 'Indicá si el envío en San Nicolás está activo (sí o no).'
  else datos.envioLocal.habilitado = local.habilitado
  if (!Number.isInteger(local.costo) || local.costo < 0 || local.costo > MAX_COSTO) {
    campos['envioLocal.costo'] = 'El costo tiene que ser un número entero, de 0 a 1.000.000.'
  } else {
    datos.envioLocal.costo = local.costo
  }
  datos.envioLocal.texto = texto(local.texto, 'envioLocal.texto', 120, campos, 'El texto del envío')

  const nacional = b.envioNacional && typeof b.envioNacional === 'object' ? b.envioNacional : {}
  datos.envioNacional = {}
  if (typeof nacional.habilitado !== 'boolean') campos['envioNacional.habilitado'] = 'Indicá si el envío a todo el país está activo (sí o no).'
  else datos.envioNacional.habilitado = nacional.habilitado
  datos.envioNacional.texto = texto(nacional.texto, 'envioNacional.texto', 200, campos, 'El texto del envío')

  // Los vacíos se descartan. Los errores de cada texto usan su posición en lo que se mandó,
  // así el panel los muestra en la fila correcta aunque haya filas vacías en el medio.
  if (b.marquesina !== undefined && b.marquesina !== null && !Array.isArray(b.marquesina)) {
    campos.marquesina = 'La marquesina tiene que ser una lista de textos.'
  } else {
    datos.marquesina = []
    let cantidad = 0 // también los que tienen error, para el límite
    for (const [i, t] of (b.marquesina ?? []).entries()) {
      if (typeof t === 'string' && !t.trim()) continue
      cantidad++
      const limpio = texto(t, `marquesina.${i}`, 40, campos, 'El texto de la marquesina')
      if (limpio) datos.marquesina.push(limpio)
    }
    if (cantidad > MAX_MARQUESINA) campos.marquesina = `La marquesina puede tener hasta ${MAX_MARQUESINA} textos.`
  }

  return Object.keys(campos).length ? { campos } : { datos }
}

/** GET /api/admin/configuracion: sin CDN. Si el documento no existe, los valores por defecto (no lo crea). */
export async function ver(req, res) {
  res.json(await leer())
}

/** PUT /api/admin/configuracion: la configuración completa. */
export async function guardar(req, res) {
  const { datos, campos } = validarConfiguracion(req.body)
  if (campos) return res.status(400).json({ error: 'Revisá los datos de la configuración.', campos })

  await sanityEscritura().createOrReplace({ _id: ID, _type: 'configuracion', ...datos })
  res.json(await leer())
}
