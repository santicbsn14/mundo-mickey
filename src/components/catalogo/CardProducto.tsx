import { Link } from 'react-router-dom'
import { urlImagen } from '../../lib/sanity.ts'
import { pesos } from '../../lib/formato.ts'
import type { Producto } from '../../types/producto.ts'
import './CardProducto.css'

interface Props {
  producto: Producto
  destacada?: boolean
  /** Clase extra de la grilla (por ejemplo, `card--ancha-mobile`). */
  className?: string
  /** El carrito se conecta en el brief 05. Sin esta prop, no hay botón "Agregar". */
  onAgregar?: (producto: Producto) => void
}

// Anchos del srcset y `sizes` según el tamaño de la card en la grilla
const IMAGEN = {
  normal: { anchos: [300, 600], sizes: '(min-width: 900px) 380px, 50vw' },
  destacada: { anchos: [600, 1200], sizes: '(min-width: 900px) 780px, 100vw' },
}

export default function CardProducto({ producto, destacada = false, className, onAgregar }: Props) {
  const url = `/producto/${producto.slug}`
  const portada = producto.imagenes?.[0]
  const { anchos, sizes } = destacada ? IMAGEN.destacada : IMAGEN.normal
  const sinStock = producto.stock <= 0

  const clases = ['card', destacada && 'card--destacada', className].filter(Boolean).join(' ')

  return (
    <article className={clases}>
      <div className="card__foto">
        {producto.badge && <span className="card__badge">{producto.badge}</span>}
        {/* Fuera del orden de tabulación: el nombre ya es un link al mismo lugar */}
        <Link to={url} className="card__foto-link" tabIndex={-1}>
          {portada && (
            <img
              src={urlImagen(portada, anchos[0]!)}
              srcSet={anchos.map((w) => `${urlImagen(portada, w)} ${w}w`).join(', ')}
              sizes={sizes}
              alt={producto.nombre}
              loading={destacada ? undefined : 'lazy'}
              decoding="async"
            />
          )}
        </Link>
      </div>

      <div className="card__cuerpo">
        <h3 className="card__nombre">
          <Link to={url}>{producto.nombre}</Link>
        </h3>
        {producto.descripcion && <p className="card__detalle">{producto.descripcion}</p>}
        <div className="card__pie">
          <span className="card__precio">{pesos(producto.precio)}</span>
          {sinStock ? (
            <span className="card__sin-stock">Sin stock</span>
          ) : (
            onAgregar && (
              <button type="button" className="card__agregar" onClick={() => onAgregar(producto)}>
                Agregar
              </button>
            )
          )}
        </div>
      </div>
    </article>
  )
}
