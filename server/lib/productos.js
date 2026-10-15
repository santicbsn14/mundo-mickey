// Reglas de los productos del panel: forma de la respuesta, validación y slug.

/** Proyección GROQ que devuelve el panel: slug aplanado e imágenes con su URL, además del `_ref`. */
export const PROYECCION_ADMIN = `{
  _id,
  nombre,
  "slug": slug.current,
  descripcion,
  precio,
  stock,
  "imagenes": imagenes[]{ _key, "_ref": asset._ref, "url": asset->url },
  badge,
  destacado,
  activo,
  orden
}`

/** Igual que el seed: sin tildes, en minúsculas y con guiones. */
export function slugificar(texto) {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

/** El primer slug libre: `base`, `base-2`, `base-3`… */
export function slugLibre(base, ocupados) {
  const usados = new Set(ocupados)
  if (!usados.has(base)) return base
  let n = 2
  while (usados.has(`${base}-${n}`)) n++
  return `${base}-${n}`
}

// Id de un asset de imagen de Sanity: image-<sha1>-<ancho>x<alto>-<formato>
const ID_IMAGEN = /^image-[a-zA-Z0-9]+-\d+x\d+-[a-z0-9]+$/

const MAX_IMAGENES = 8

/**
 * Valida el cuerpo de un POST o PUT. Ignora cualquier campo que no sea de la lista
 * (incluidos `slug`, `orden` y `_id`). Devuelve `{ datos }` o `{ campos }` con los mensajes.
 * No consulta Sanity: que las imágenes existan lo verifica el controller.
 */
export function validarProducto(cuerpo) {
  const b = cuerpo && typeof cuerpo === 'object' ? cuerpo : {}
  const campos = {}
  const datos = {}

  if (typeof b.nombre !== 'string' || !b.nombre.trim()) {
    campos.nombre = 'El nombre es obligatorio.'
  } else {
    datos.nombre = b.nombre.trim()
    if (datos.nombre.length < 2 || datos.nombre.length > 80) campos.nombre = 'El nombre tiene que tener entre 2 y 80 caracteres.'
  }

  if (b.descripcion === undefined || b.descripcion === null) {
    datos.descripcion = ''
  } else if (typeof b.descripcion !== 'string') {
    campos.descripcion = 'La descripción tiene que ser un texto.'
  } else {
    datos.descripcion = b.descripcion.trim()
    if (datos.descripcion.length > 300) campos.descripcion = 'La descripción puede tener hasta 300 caracteres.'
  }

  if (!Number.isInteger(b.precio) || b.precio <= 0) campos.precio = 'El precio tiene que ser un número entero mayor a 0.'
  else datos.precio = b.precio

  if (!Number.isInteger(b.stock) || b.stock < 0) campos.stock = 'El stock tiene que ser un número entero, 0 o más.'
  else datos.stock = b.stock

  if (!Array.isArray(b.imagenes) || b.imagenes.length === 0) {
    campos.imagenes = 'Subí al menos una foto.'
  } else if (b.imagenes.length > MAX_IMAGENES) {
    campos.imagenes = `Puede tener hasta ${MAX_IMAGENES} fotos.`
  } else if (!b.imagenes.every((id) => typeof id === 'string' && ID_IMAGEN.test(id))) {
    campos.imagenes = 'Alguna de las fotos no es válida.'
  } else if (new Set(b.imagenes).size !== b.imagenes.length) {
    campos.imagenes = 'Hay una foto repetida.'
  } else {
    datos.imagenes = b.imagenes
  }

  if (b.badge === undefined || b.badge === null) {
    datos.badge = ''
  } else if (typeof b.badge !== 'string') {
    campos.badge = 'La etiqueta tiene que ser un texto.'
  } else {
    datos.badge = b.badge.trim()
    if (datos.badge.length > 24) campos.badge = 'La etiqueta puede tener hasta 24 caracteres.'
  }

  if (typeof b.destacado !== 'boolean') campos.destacado = 'Indicá si el producto es destacado (sí o no).'
  else datos.destacado = b.destacado

  if (typeof b.activo !== 'boolean') campos.activo = 'Indicá si el producto está visible en la tienda (sí o no).'
  else datos.activo = b.activo

  return Object.keys(campos).length ? { campos } : { datos }
}
