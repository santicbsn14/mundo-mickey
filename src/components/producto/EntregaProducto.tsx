import { useConfiguracion } from '../../hooks/useConfiguracion.ts'
import { pesos } from '../../lib/formato.ts'
import './EntregaProducto.css'

/** Formas de entrega habilitadas en la configuración. Sin configuración, solo el retiro. */
export default function EntregaProducto() {
  const { configuracion } = useConfiguracion()

  const direccion = configuracion?.direccion?.trim()
  const horarios = configuracion?.horarios?.trim()
  const local = configuracion?.envioLocal
  const nacional = configuracion?.envioNacional

  return (
    <section className="entrega" aria-labelledby="entrega-titulo">
      <h2 className="entrega__titulo" id="entrega-titulo">Entrega</h2>
      <ul className="entrega__lista">
        <li>
          <div className="entrega__fila">
            <strong>Retiro en el local</strong>
            <span className="entrega__costo">Gratis</span>
          </div>
          {direccion && <p>{direccion}</p>}
          {horarios && <p>{horarios}</p>}
        </li>

        {local?.habilitado && (
          <li>
            <div className="entrega__fila">
              <strong>Envío en San Nicolás</strong>
              {typeof local.costo === 'number' && <span className="entrega__costo">{pesos(local.costo)}</span>}
            </div>
            {local.texto?.trim() && <p>{local.texto.trim()}</p>}
          </li>
        )}

        {nacional?.habilitado && (
          <li>
            <div className="entrega__fila">
              <strong>Envío a todo el país</strong>
            </div>
            {nacional.texto?.trim() && <p>{nacional.texto.trim()}</p>}
          </li>
        )}
      </ul>
    </section>
  )
}
