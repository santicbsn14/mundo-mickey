import { useParams } from 'react-router-dom'

export default function AdminPedidoDetalle() {
  const { id } = useParams()
  return (
    <section className="contenedor placeholder">
      <h1>Detalle del pedido</h1>
      <p>ID: {id}</p>
    </section>
  )
}
