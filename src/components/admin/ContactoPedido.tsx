import { useState } from 'react'
import { useConfiguracion } from '../../hooks/useConfiguracion.ts'
import { numeroPedido } from '../../lib/formato.ts'
import {
  celularLegible,
  linkWhatsapp,
  mensajePlantilla,
  NOMBRE_PLANTILLA,
  plantillaSugerida,
  type Pedido,
  type Plantilla,
} from '../../lib/pedidosAdmin.ts'
import './ContactoPedido.css'

const PLANTILLAS = Object.keys(NOMBRE_PLANTILLA) as Plantilla[]

/** Datos del comprador y los botones para escribirle (WhatsApp con plantillas), mandarle un email o llamarlo. */
export default function ContactoPedido({ pedido }: { pedido: Pedido }) {
  const { cliente } = pedido
  const { configuracion } = useConfiguracion()
  const local = { direccion: configuracion?.direccion, horarios: configuracion?.horarios }

  // La plantilla sugerida cambia con el estado; si el dueño eligió otra o editó el texto, se respeta
  const sugerida = plantillaSugerida(pedido)
  const [elegida, setElegida] = useState<Plantilla | null>(null)
  const [editado, setEditado] = useState<string | null>(null)
  const plantilla = elegida ?? sugerida
  const texto = editado ?? mensajePlantilla(plantilla, pedido, local)

  const saludo = mensajePlantilla('libre', pedido, local)
  const mailto = `mailto:${cliente.email}?subject=${encodeURIComponent(`Tu pedido ${numeroPedido(pedido.numero)} en Mundo Mickey`)}&body=${encodeURIComponent(saludo)}`

  return (
    <section className="dp__seccion dp__seccion--comprador contacto" aria-labelledby="dp-comprador">
      <h2 id="dp-comprador" className="dp__subtitulo">
        Comprador
      </h2>
      <p className="contacto__nombre">
        {cliente.nombre} {cliente.apellido}
      </p>
      <dl className="dp__datos">
        <div>
          <dt>DNI</dt>
          <dd>{cliente.dni}</dd>
        </div>
        <div>
          <dt>Celular</dt>
          <dd>{celularLegible(cliente.celular)}</dd>
        </div>
        <div>
          <dt>Email</dt>
          <dd className="contacto__email">{cliente.email}</dd>
        </div>
      </dl>

      <div className="contacto__whatsapp">
        <div className="campo">
          <label htmlFor="ct-plantilla" className="campo__label">
            Mensaje de WhatsApp
          </label>
          <select
            id="ct-plantilla"
            className="campo__input"
            value={plantilla}
            aria-describedby="ct-plantilla-ayuda"
            onChange={(e) => {
              setElegida(e.target.value as Plantilla)
              setEditado(null)
            }}
          >
            {PLANTILLAS.map((p) => (
              <option key={p} value={p}>
                {NOMBRE_PLANTILLA[p]}
              </option>
            ))}
          </select>
          <p id="ct-plantilla-ayuda" className="campo__ayuda">
            {plantilla === sugerida ? 'Es el sugerido para este pedido.' : `Sugerido para este pedido: «${NOMBRE_PLANTILLA[sugerida]}».`}
          </p>
        </div>
        <div className="campo">
          <label htmlFor="ct-texto" className="adm-oculto">
            Texto del mensaje
          </label>
          <textarea
            id="ct-texto"
            className="campo__input campo__textarea"
            value={texto}
            rows={4}
            maxLength={1000}
            onChange={(e) => setEditado(e.target.value)}
          />
          {editado !== null && (
            <button type="button" className="adm-btn adm-btn--texto contacto__restaurar" onClick={() => setEditado(null)}>
              Volver al texto de la plantilla
            </button>
          )}
        </div>
      </div>

      <div className="contacto__botones">
        <a className="adm-btn adm-btn--amarillo contacto__boton" href={linkWhatsapp(cliente.celular, texto)} target="_blank" rel="noopener noreferrer">
          WhatsApp
          <span className="adm-oculto"> (se abre en otra pestaña)</span>
        </a>
        <a className="adm-btn contacto__boton" href={mailto}>
          Email
        </a>
        <a className="adm-btn contacto__boton" href={`tel:+${cliente.celular}`}>
          Llamar
        </a>
      </div>
    </section>
  )
}
