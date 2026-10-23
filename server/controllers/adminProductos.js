import { randomBytes, randomUUID } from 'node:crypto'
import { sanityEscritura, sanityLectura } from '../lib/sanity.js'
import { PROYECCION_ADMIN, slugLibre, slugificar, validarProducto } from '../lib/productos.js'

const nuevaKey = () => randomBytes(6).toString('hex')

async function buscarProducto(id) {
  return sanityLectura().fetch(`*[_type == "producto" && _id == $id][0]${PROYECCION_ADMIN}`, { id })
}

/** Valida el cuerpo y que existan todas las imágenes. Devuelve los datos, o responde 400 y devuelve null. */
async function validarCuerpo(req, res) {
  const { datos, campos } = validarProducto(req.body)
  if (campos) {
    res.status(400).json({ error: 'Revisá los datos del producto.', campos })
    return null
  }

  const existentes = await sanityLectura().fetch('count(*[_type == "sanity.imageAsset" && _id in $ids])', { ids: datos.imagenes })
  if (existentes !== datos.imagenes.length) {
    res.status(400).json({
      error: 'Revisá los datos del producto.',
      campos: { imagenes: 'Alguna de las fotos ya no existe. Volvé a subirla.' },
    })
    return null
  }
  return datos
}

/** Los campos editables, listos para guardar. `keys` reutiliza el `_key` de las imágenes que ya estaban. */
function camposAGuardar(datos, keys = new Map()) {
  return {
    nombre: datos.nombre,
    descripcion: datos.descripcion,
    precio: datos.precio,
    stock: datos.stock,
    imagenes: datos.imagenes.map((ref) => ({
      _type: 'image',
      _key: keys.get(ref) ?? nuevaKey(),
      asset: { _type: 'reference', _ref: ref },
    })),
    destacado: datos.destacado,
    activo: datos.activo,
  }
}

/** Si `destacado`, suma a la transacción el desmarcado de los demás destacados. */
async function desmarcarOtrosDestacados(tx, id, destacado) {
  if (!destacado) return
  const otros = await sanityLectura().fetch('*[_type == "producto" && destacado == true && _id != $id]._id', { id })
  for (const otro of otros) tx.patch(otro, (p) => p.set({ destacado: false }))
}

/** GET /api/admin/productos: todos, también los inactivos, por `orden`. */
export async function listar(req, res) {
  const productos = await sanityLectura().fetch(`*[_type == "producto"] | order(orden asc, _createdAt asc)${PROYECCION_ADMIN}`)
  res.json(productos)
}

/** GET /api/admin/productos/:id */
export async function ver(req, res) {
  const producto = await buscarProducto(req.params.id)
  if (!producto) return res.status(404).json({ error: 'El producto no existe.' })
  res.json(producto)
}

/** POST /api/admin/productos */
export async function crear(req, res) {
  const datos = await validarCuerpo(req, res)
  if (!datos) return

  const base = slugificar(datos.nombre) || 'producto'
  const [ocupados, ordenMaximo] = await Promise.all([
    sanityLectura().fetch(
      '*[_type == "producto" && (slug.current == $base || string::startsWith(slug.current, $prefijo))].slug.current',
      { base, prefijo: `${base}-` },
    ),
    sanityLectura().fetch('math::max(*[_type == "producto"].orden)'),
  ])

  const id = randomUUID()
  const documento = {
    _id: id,
    _type: 'producto',
    ...camposAGuardar(datos),
    // El slug queda fijo: editar el nombre después no lo cambia, para no romper links compartidos
    slug: { _type: 'slug', current: slugLibre(base, ocupados) },
    orden: (ordenMaximo ?? 0) + 1,
    ...(datos.badge && { badge: datos.badge }),
  }

  const tx = sanityEscritura().transaction().create(documento)
  await desmarcarOtrosDestacados(tx, id, datos.destacado)
  await tx.commit()

  res.status(201).json(await buscarProducto(id))
}

/** PUT /api/admin/productos/:id: mismas reglas que crear. No toca `slug` ni `orden`. */
export async function editar(req, res) {
  const { id } = req.params
  const actual = await buscarProducto(id)
  if (!actual) return res.status(404).json({ error: 'El producto no existe.' })

  const datos = await validarCuerpo(req, res)
  if (!datos) return

  const keys = new Map((actual.imagenes ?? []).map((img) => [img._ref, img._key]))
  const tx = sanityEscritura()
    .transaction()
    .patch(id, (p) => {
      const patch = p.set(camposAGuardar(datos, keys))
      return datos.badge ? patch.set({ badge: datos.badge }) : patch.unset(['badge'])
    })
  await desmarcarOtrosDestacados(tx, id, datos.destacado)
  await tx.commit()

  res.json(await buscarProducto(id))
}

/** PATCH /api/admin/productos/orden con `{ ids }`: `orden` de 1 a N según la posición. */
export async function reordenar(req, res) {
  const { ids } = req.body ?? {}
  if (!Array.isArray(ids) || !ids.every((id) => typeof id === 'string')) {
    return res.status(400).json({ error: 'Mandá la lista de ids de los productos en el orden nuevo.' })
  }
  if (new Set(ids).size !== ids.length) {
    return res.status(400).json({ error: 'Hay productos repetidos en el orden.' })
  }

  const existentes = await sanityLectura().fetch('*[_type == "producto"]._id')
  const enviados = new Set(ids)
  if (ids.length !== existentes.length || !existentes.every((id) => enviados.has(id))) {
    return res.status(400).json({ error: 'El orden tiene que incluir todos los productos, sin faltantes ni de más. Recargá la lista y probá de nuevo.' })
  }

  const tx = sanityEscritura().transaction()
  ids.forEach((id, i) => tx.patch(id, (p) => p.set({ orden: i + 1 })))
  await tx.commit()

  res.json(await sanityLectura().fetch(`*[_type == "producto"] | order(orden asc)${PROYECCION_ADMIN}`))
}

/**
 * DELETE /api/admin/productos/:id: borra solo el documento. Las fotos quedan, porque los pedidos
 * guardan la URL de la imagen; las que no usa nadie las limpia `npm run imagenes:limpiar`.
 */
export async function eliminar(req, res) {
  const { id } = req.params
  const producto = await buscarProducto(id)
  if (!producto) return res.status(404).json({ error: 'El producto no existe.' })

  await sanityEscritura().delete(id)
  res.status(204).end()
}
