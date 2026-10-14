import { sanity } from './sanity.ts'
import type { Producto } from '../types/producto.ts'
import type { Configuracion } from '../types/configuracion.ts'

const CAMPOS_PRODUCTO = `
  _id, nombre, "slug": slug.current, descripcion, precio, stock,
  imagenes, badge, destacado, activo, orden
`

/** Productos visibles en la tienda, en el orden de la grilla. */
export function obtenerProductos(): Promise<Producto[]> {
  return sanity.fetch<Producto[]>(
    `*[_type == "producto" && activo == true] | order(orden asc) { ${CAMPOS_PRODUCTO} }`,
  )
}

/** Un producto activo por su slug, o `null` si no existe o está oculto. */
export async function obtenerProductoPorSlug(slug: string): Promise<Producto | null> {
  const producto = await sanity.fetch<Producto | null>(
    `*[_type == "producto" && activo == true && slug.current == $slug][0] { ${CAMPOS_PRODUCTO} }`,
    { slug },
  )
  return producto ?? null
}

/** Configuración del local, o `null` si todavía no se cargó. */
export async function obtenerConfiguracion(): Promise<Configuracion | null> {
  const config = await sanity.fetch<Configuracion | null>(
    `*[_id == "configuracion"][0] {
      whatsapp, instagram, direccion, horarios, envioLocal, envioNacional, marquesina
    }`,
  )
  return config ?? null
}
