import { useParams } from 'react-router-dom'
import DetallePedido from '../../components/admin/DetallePedido.tsx'

export default function AdminPedidoDetalle() {
  const { id = '' } = useParams()
  return (
    <div className="contenedor">
      {/* key: al pasar de un pedido a otro, arranca de cero */}
      <DetallePedido key={id} id={id} />
    </div>
  )
}
