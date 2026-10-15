import { useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useCarrito } from '../../context/CarritoContext.tsx'
import { pesos } from '../../lib/formato.ts'
import ItemCarrito from './ItemCarrito.tsx'
import { ID_BOTON_CARRITO } from './volarAlCarrito.ts'
import './CarritoDrawer.css'

const ENFOCABLES = 'a[href], button:not(:disabled), input:not(:disabled), [tabindex]:not([tabindex="-1"])'

/**
 * Drawer lateral del carrito, como el de la maqueta. La entrega y el pago van en /checkout: acá solo
 * el subtotal y "Continuar compra".
 */
export default function CarritoDrawer() {
  const { items, subtotal, abierto, cerrar, actualizado } = useCarrito()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const panel = useRef<HTMLDivElement>(null)
  const botonCerrar = useRef<HTMLButtonElement>(null)

  // Se cierra solo al cambiar de página
  useEffect(() => {
    cerrar()
  }, [pathname, cerrar])

  // Foco al abrir y al cerrar
  const estabaAbierto = useRef(false)
  useEffect(() => {
    if (abierto) botonCerrar.current?.focus()
    else if (estabaAbierto.current) document.getElementById(ID_BOTON_CARRITO)?.focus({ preventScroll: true })
    estabaAbierto.current = abierto
  }, [abierto])

  // Abierto: Escape cierra, el foco queda adentro y la página de atrás no scrollea
  useEffect(() => {
    if (!abierto) return

    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        cerrar()
        return
      }
      if (e.key !== 'Tab' || !panel.current) return
      const enfocables = [...panel.current.querySelectorAll<HTMLElement>(ENFOCABLES)]
      const primero = enfocables[0]
      const ultimo = enfocables.at(-1)
      if (!primero || !ultimo) return
      const activo = document.activeElement
      const adentro = activo instanceof Node && panel.current.contains(activo)
      if (e.shiftKey && (activo === primero || !adentro)) {
        e.preventDefault()
        ultimo.focus()
      } else if (!e.shiftKey && (activo === ultimo || !adentro)) {
        e.preventDefault()
        primero.focus()
      }
    }
    document.addEventListener('keydown', alTeclear)

    const html = document.documentElement
    const antes = { overflow: html.style.overflow, gutter: html.style.scrollbarGutter }
    html.style.overflow = 'hidden'
    // Reserva el lugar de la barra de scroll: sin esto, la página de atrás se corre al abrir
    html.style.scrollbarGutter = 'stable'

    return () => {
      document.removeEventListener('keydown', alTeclear)
      html.style.overflow = antes.overflow
      html.style.scrollbarGutter = antes.gutter
    }
  }, [abierto, cerrar])

  // Si el ítem que tenía el foco desaparece ("−" en 1), el foco vuelve a cerrar y no se escapa al body
  useEffect(() => {
    if (!abierto || !panel.current) return
    const activo = document.activeElement
    if (!(activo instanceof Node) || !panel.current.contains(activo)) botonCerrar.current?.focus()
  }, [abierto, items.length])

  const continuar = () => {
    cerrar()
    navigate('/checkout')
  }

  return (
    <>
      <div className={`velo${abierto ? ' velo--on' : ''}`} onClick={cerrar} aria-hidden="true" />
      <div
        ref={panel}
        className={`carrito${abierto ? ' carrito--on' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="carrito-titulo"
      >
        <div className="carrito__cab">
          <h2 id="carrito-titulo">Tu carrito</h2>
          <button ref={botonCerrar} type="button" className="carrito__cerrar" aria-label="Cerrar carrito" onClick={cerrar}>
            ✕
          </button>
        </div>

        <div className="carrito__cuerpo">
          {actualizado && (
            <p className="carrito__aviso" role="status">
              Actualizamos tu carrito porque cambió el stock de algunos juguetes.
            </p>
          )}

          {items.length > 0 ? (
            <ul className="carrito__lista">
              {items.map((item) => (
                <ItemCarrito key={item.productoId} item={item} />
              ))}
            </ul>
          ) : (
            <p className="carrito__vacio">
              <strong>Tu carrito está vacío</strong>
              Elegí algo del catálogo y aparece acá.
            </p>
          )}
        </div>

        <div className="carrito__pie">
          <div className="carrito__subtotal">
            <span>Subtotal</span>
            <strong>{pesos(subtotal)}</strong>
          </div>
          <p className="carrito__nota">El envío lo elegís en el siguiente paso.</p>
          <button type="button" className="carrito__continuar" disabled={items.length === 0} onClick={continuar}>
            Continuar compra
          </button>
        </div>
      </div>
    </>
  )
}
