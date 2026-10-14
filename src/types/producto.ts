/** Imagen de Sanity tal como queda guardada en el documento (referencia al asset). */
export interface ImagenSanity {
  _type: 'image'
  _key: string
  asset: { _type: 'reference'; _ref: string }
}

/** Producto de Sanity. `slug` viene aplanado por la query (`slug.current`). */
export interface Producto {
  _id: string
  nombre: string
  slug: string
  descripcion: string
  precio: number
  stock: number
  /** La primera es la portada. */
  imagenes: ImagenSanity[]
  badge?: string
  destacado: boolean
  activo: boolean
  orden: number
}
