import { Link } from 'react-router-dom'
import { useCarrito } from '../../context/CarritoContext.tsx'
import { ID_BOTON_CARRITO } from '../carrito/volarAlCarrito.ts'
import './Header.css'

export default function Header() {
  // El `pop` al agregar lo hace volarAlCarrito, que encuentra el botón por su id
  const { cantidadTotal: cantidad, abrir } = useCarrito()

  return (
    <header className="header">
      <div className="contenedor header__fila">
        <Link className="header__logo" to="/" aria-label="Mundo Mickey, ir al inicio">
          <img src="/logo.png" alt="Mundo Mickey" width={95} height={52} />
        </Link>

        <nav className="header__nav" aria-label="Secciones">
          <Link to="/#productos">Productos</Link>
          <Link to="/#como-comprar">Cómo comprar</Link>
          <Link to="/#contacto">Contacto</Link>
        </nav>

        <button
          type="button"
          id={ID_BOTON_CARRITO}
          className="btn-carrito"
          aria-label={`Abrir carrito, ${cantidad} ${cantidad === 1 ? 'producto' : 'productos'}`}
          onClick={abrir}
        >
          Carrito <span className="btn-carrito__cant" aria-hidden="true">{cantidad}</span>
        </button>
      </div>
    </header>
  )
}
