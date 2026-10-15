import { useCarrito } from '../../context/CarritoContext.tsx'
import { useProductos } from '../../hooks/useProductos.ts'
import type { Producto } from '../../types/producto.ts'
import { volarAlCarrito } from '../carrito/volarAlCarrito.ts'
import CardProducto from '../catalogo/CardProducto.tsx'
import './OtrosProductos.css'

interface Props {
  actualId: string
}

const MAXIMO = 4

/** Hasta 4 productos que no son el actual, por `orden`. Si no hay o falla la carga, no se muestra. */
export default function OtrosProductos({ actualId }: Props) {
  const { estado, productos } = useProductos()
  const { agregar, cantidadDe } = useCarrito()
  if (estado !== 'ok') return null

  // La query ya los trae por `orden`
  const otros = productos.filter((p) => p._id !== actualId).slice(0, MAXIMO)
  if (otros.length === 0) return null

  const alAgregar = (producto: Producto, origen: HTMLElement) => {
    agregar(producto)
    volarAlCarrito(origen)
  }

  return (
    <section className="otros" aria-labelledby="otros-titulo">
      <h2 className="otros__titulo" id="otros-titulo">Otros juguetes</h2>
      <div className="otros__grilla">
        {otros.map((p) => (
          <CardProducto key={p._id} producto={p} onAgregar={alAgregar} enCarrito={cantidadDe(p._id)} />
        ))}
      </div>
    </section>
  )
}
