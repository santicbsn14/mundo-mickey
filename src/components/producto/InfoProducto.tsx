import { useCarrito } from '../../context/CarritoContext.tsx'
import { useConfiguracion } from '../../hooks/useConfiguracion.ts'
import { pesos } from '../../lib/formato.ts'
import type { Producto } from '../../types/producto.ts'
import { useSumado } from '../carrito/useSumado.ts'
import { volarAlCarrito } from '../carrito/volarAlCarrito.ts'
import './InfoProducto.css'

interface Props {
  producto: Producto
}

/** Con este stock o menos se avisa cuántas unidades quedan. */
const POCAS_UNIDADES = 3

export default function InfoProducto({ producto }: Props) {
  const { configuracion } = useConfiguracion()
  const whatsapp = configuracion?.whatsapp?.replace(/\D/g, '')
  const mensaje = `Hola! Quiero consultar por "${producto.nombre}"`

  const { agregar, cantidadDe, abrir } = useCarrito()
  const [sumado, marcarSumado] = useSumado()

  const { stock } = producto
  const enCarrito = cantidadDe(producto._id)
  const lleno = enCarrito >= stock
  const aviso =
    stock <= 0 ? null : stock === 1 ? '¡Queda 1!' : stock <= POCAS_UNIDADES ? `¡Quedan ${stock}!` : null

  return (
    <div className="info">
      {producto.badge && <span className="info__badge">{producto.badge}</span>}
      <h1 className="info__nombre">{producto.nombre}</h1>
      <p className="info__precio">{pesos(producto.precio)}</p>
      {producto.descripcion && <p className="info__descripcion">{producto.descripcion}</p>}

      {stock <= 0 && <span className="info__sin-stock">Sin stock</span>}
      {aviso && <span className="info__quedan">{aviso}</span>}

      <div className="info__acciones">
        {stock > 0 && (
          <div className="info__compra">
            {/* aria-disabled y no disabled: así el botón no pierde el foco al llegar al tope */}
            <button
              type="button"
              className="info__agregar"
              aria-disabled={lleno || undefined}
              onClick={(e) => {
                if (lleno) return
                agregar(producto)
                volarAlCarrito(e.currentTarget)
                marcarSumado()
              }}
            >
              {sumado ? '¡Sumado!' : lleno ? 'Sin más stock' : 'Agregar al carrito'}
            </button>
            <p className="info__en-carrito" aria-live="polite">
              {enCarrito > 0 && (
                <>
                  Tenés {enCarrito} en el carrito ·{' '}
                  <button type="button" className="info__ver-carrito" onClick={abrir}>
                    Ver carrito
                  </button>
                </>
              )}
            </p>
          </div>
        )}

        {whatsapp && (
          <a
            className="info__whatsapp"
            href={`https://wa.me/${whatsapp}?text=${encodeURIComponent(mensaje)}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            Consultar por WhatsApp
          </a>
        )}
      </div>
    </div>
  )
}
