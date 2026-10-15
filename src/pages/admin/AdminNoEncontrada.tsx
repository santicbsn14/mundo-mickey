import { Link } from 'react-router-dom'

// El `*` dentro del panel: sin esto, /admin/<inexistente> caía en el NotFound de la tienda
export default function AdminNoEncontrada() {
  return (
    <section className="contenedor admin-vacia">
      <h1>Esta sección no existe</h1>
      <p>
        <Link to="/admin">Ir a Pedidos</Link>
      </p>
    </section>
  )
}
