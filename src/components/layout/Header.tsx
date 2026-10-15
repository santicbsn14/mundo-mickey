import { Link } from 'react-router-dom'
import './Header.css'

export default function Header() {
  // Contador fijo hasta el brief 05 (carrito)
  const cantidad = 0

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

        <button type="button" className="btn-carrito" aria-label={`Abrir carrito, ${cantidad} productos`}>
          Carrito <span className="btn-carrito__cant" aria-hidden="true">{cantidad}</span>
        </button>
      </div>
    </header>
  )
}
