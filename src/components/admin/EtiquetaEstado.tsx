import { NOMBRE_ESTADO, type EstadoPedido } from '../../lib/pedidosAdmin.ts'
import './EtiquetaEstado.css'

/** El estado de un pedido, con relleno y borde propios: se distinguen sin depender del color. */
export default function EtiquetaEstado({ estado, grande = false }: { estado: EstadoPedido; grande?: boolean }) {
  return <span className={`etiqueta-estado etiqueta-estado--${estado}${grande ? ' etiqueta-estado--grande' : ''}`}>{NOMBRE_ESTADO[estado]}</span>
}
