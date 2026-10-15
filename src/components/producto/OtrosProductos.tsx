import { useProductos } from '../../hooks/useProductos.ts'
import CardProducto from '../catalogo/CardProducto.tsx'
import './OtrosProductos.css'

interface Props {
  actualId: string
}

const MAXIMO = 4

/** Hasta 4 productos que no son el actual, por `orden`. Si no hay o falla la carga, no se muestra. */
export default function OtrosProductos({ actualId }: Props) {
  const { estado, productos } = useProductos()
  if (estado !== 'ok') return null

  // La query ya los trae por `orden`
  const otros = productos.filter((p) => p._id !== actualId).slice(0, MAXIMO)
  if (otros.length === 0) return null

  return (
    <section className="otros" aria-labelledby="otros-titulo">
      <h2 className="otros__titulo" id="otros-titulo">Otros juguetes</h2>
      <div className="otros__grilla">
        {otros.map((p) => (
          <CardProducto key={p._id} producto={p} />
        ))}
      </div>
    </section>
  )
}
