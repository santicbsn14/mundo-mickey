import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <section className="contenedor placeholder">
      <h1>Página no encontrada</h1>
      <p>
        Lo que buscás no está acá. <Link to="/">Volver al inicio</Link>
      </p>
    </section>
  )
}
