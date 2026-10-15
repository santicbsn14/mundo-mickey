import { Link } from 'react-router-dom'
import { useCarrito, type ItemCarrito as Item } from '../../context/CarritoContext.tsx'
import { pesos } from '../../lib/formato.ts'
import { urlImagen } from '../../lib/sanity.ts'
import './ItemCarrito.css'

interface Props {
  item: Item
}

export default function ItemCarrito({ item }: Props) {
  const { cambiarCantidad, cerrar } = useCarrito()
  const tope = item.cantidad >= item.stock

  return (
    <li className="item">
      <div className="item__mini">
        {item.imagen && <img src={urlImagen(item.imagen, 112)} alt="" width={56} height={56} decoding="async" />}
      </div>
      {/* También cierra: si ya se está en ese detalle, no hay cambio de ruta que lo cierre */}
      <Link className="item__nombre" to={`/producto/${item.slug}`} onClick={cerrar}>
        {item.nombre}
      </Link>
      <span className="item__precio">{pesos(item.cantidad * item.precio)}</span>

      <div className="item__controles">
        <div className="cantidad">
          <button
            type="button"
            aria-label={`Quitar uno de ${item.nombre}`}
            onClick={() => cambiarCantidad(item.productoId, item.cantidad - 1)}
          >
            −
          </button>
          <span aria-live="polite">{item.cantidad}</span>
          {/* aria-disabled y no disabled: con el teclado, el foco no se pierde al llegar al tope */}
          <button
            type="button"
            aria-label={`Sumar uno de ${item.nombre}`}
            aria-disabled={tope || undefined}
            onClick={() => {
              if (!tope) cambiarCantidad(item.productoId, item.cantidad + 1)
            }}
          >
            +
          </button>
        </div>
        {tope && <p className="item__tope">Máximo disponible: {item.stock}</p>}
      </div>
    </li>
  )
}
