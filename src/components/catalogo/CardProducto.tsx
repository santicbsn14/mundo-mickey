import { Link } from 'react-router-dom'
import { urlImagen } from '../../lib/sanity.ts'
import { pesos } from '../../lib/formato.ts'
import type { Producto } from '../../types/producto.ts'
import { useSumado } from '../carrito/useSumado.ts'
import './CardProducto.css'

interface Props {
  producto: Producto
  destacada?: boolean
  /** Clase extra de la grilla (por ejemplo, `card--ancha-mobile`). */
  className?: string
  /** Sin esta prop no hay botón "Agregar". `origen` es el botón, desde donde vuela la estrella. */
  onAgregar?: (producto: Producto, origen: HTMLElement) => void
  /** Unidades de este producto que ya están en el carrito: al llegar al stock, "Sin más stock". */
  enCarrito?: number
}

// Anchos del srcset y `sizes` según el tamaño de la card en la grilla
const IMAGEN = {
  normal: { anchos: [300, 600], sizes: '(min-width: 900px) 380px, 50vw' },
  destacada: { anchos: [600, 1200], sizes: '(min-width: 900px) 780px, 100vw' },
}

export default function CardProducto({ producto, destacada = false, className, onAgregar, enCarrito = 0 }: Props) {
  const [sumado, marcarSumado] = useSumado()
  const url = `/producto/${producto.slug}`
  const portada = producto.imagenes?.[0]
  const { anchos, sizes } = destacada ? IMAGEN.destacada : IMAGEN.normal
  const sinStock = producto.stock <= 0
  const lleno = enCarrito >= producto.stock

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
              // aria-disabled y no disabled: así el botón no pierde el foco al llegar al tope
              <button
                type="button"
                className="card__agregar"
                aria-disabled={lleno || undefined}
                onClick={(e) => {
                  if (lleno) return
                  onAgregar(producto, e.currentTarget)
                  marcarSumado()
                }}
              >
                {sumado ? '¡Sumado!' : lleno ? 'Sin más stock' : 'Agregar'}
              </button>
            )
          )}
        </div>
      </div>
    </article>
  )
}
