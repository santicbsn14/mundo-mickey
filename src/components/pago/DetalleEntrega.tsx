import type { Configuracion } from '../../types/configuracion.ts'
import type { TipoEntrega } from './useEstadoPedido.ts'
import './DetalleEntrega.css'

interface Props {
  tipo: TipoEntrega
  configuracion: Configuracion | null
}

/** Qué pasa ahora con la entrega, debajo de "¡Listo!". */
export default function DetalleEntrega({ tipo, configuracion }: Props) {
  if (tipo === 'envio_local') return <p>Te escribimos para coordinar la entrega.</p>
  if (tipo === 'envio_nacional') return <p>Te contactamos por WhatsApp para coordinar el envío y su costo.</p>

  const direccion = configuracion?.direccion?.trim()
  const horarios = configuracion?.horarios?.trim()
  return (
    <>
      <p>Te avisamos por WhatsApp cuando esté listo para retirar.</p>
      {(direccion || horarios) && (
        <dl className="detalle-entrega">
          {direccion && (
            <div>
              <dt>Dirección</dt>
              <dd>{direccion}</dd>
            </div>
          )}
          {horarios && (
            <div>
              <dt>Horarios</dt>
              <dd className="detalle-entrega__horarios">{horarios}</dd>
            </div>
          )}
        </dl>
      )}
    </>
  )
}
