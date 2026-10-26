// Productos tal como los devuelve la API del panel (`PROYECCION_ADMIN` en server/lib/productos.js).

/** Imagen del formulario: el id del asset (`_ref`) y su URL. `_key` solo en las que ya estaban guardadas. */
export interface ImagenAdmin {
  _key?: string
  _ref: string
  url: string
}

export interface ProductoAdmin {
  _id: string
  nombre: string
  slug: string
  descripcion: string | null
  precio: number
  stock: number
  /** La primera es la portada. */
  imagenes: ImagenAdmin[] | null
  badge: string | null
  destacado: boolean
  activo: boolean
  orden: number
}

/** Lo que reciben `POST` y `PUT /api/admin/productos`. `precio` y `stock` en `null` si no son enteros (la API los rechaza). */
export interface CuerpoProducto {
  nombre: string
  descripcion: string
  precio: number | null
  stock: number | null
  imagenes: string[]
  badge: string
  destacado: boolean
  activo: boolean
}

/** El producto completo para un `PUT`, con los cambios de `cambios` (por ejemplo, `{ activo: false }`). */
export function cuerpoDesde(p: ProductoAdmin, cambios: Partial<CuerpoProducto> = {}): CuerpoProducto {
  return {
    nombre: p.nombre,
    descripcion: p.descripcion ?? '',
    precio: p.precio,
    stock: p.stock,
    imagenes: (p.imagenes ?? []).map((img) => img._ref),
    badge: p.badge ?? '',
    destacado: p.destacado,
    activo: p.activo,
    ...cambios,
  }
}

/** URL de Sanity achicada a `ancho` px, sin recortar: el cuadrado lo hace el CSS, igual que en la tienda. */
export function miniatura(url: string, ancho: number) {
  return `${url}?w=${ancho}&auto=format&q=75`
}

/** Aviso que se pasa al listado por el `state` de la navegación. */
export interface EstadoListado {
  aviso?: string
}

export const AVISO_CDN = 'Puede tardar un par de minutos en verse en la tienda.'
