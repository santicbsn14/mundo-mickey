import { useRef, useState, type FormEvent, type ReactNode, type RefObject } from 'react'
import { ErrorApi } from '../../lib/api.ts'
import {
  CORRECCIONES,
  EMPRESAS,
  linkWhatsapp,
  mensajePlantilla,
  NOMBRE_ESTADO,
  type EstadoPedido,
  type Pedido,
} from '../../lib/pedidosAdmin.ts'
import type { Guardar } from './DetallePedido.tsx'
import './AccionesPedido.css'

const mensaje = (err: unknown) => (err instanceof ErrorApi ? err.message : 'Algo salió mal. Probá de nuevo.')

/** El siguiente paso del pedido, como botón principal, y las demás acciones de estado. */
export default function AccionesPedido({ pedido, guardar }: { pedido: Pedido; guardar: Guardar }) {
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const enviado = useRef<HTMLDialogElement>(null)
  const cambiar = useRef<HTMLDialogElement>(null)
  const cancelar = useRef<HTMLDialogElement>(null)

  const { estado } = pedido
  const conEnvio = pedido.entrega.tipo !== 'retiro'
  const correcciones = CORRECCIONES[estado] ?? []
  const cancelable = estado === 'pendiente_pago' || estado === 'pagado'
  const reponible = estado === 'cancelado' && pedido.stockDescontado && !pedido.stockRepuesto

  async function aplicar(cambios: Parameters<Guardar>[0]) {
    setOcupado(true)
    setError(null)
    try {
      await guardar(cambios)
    } catch (err) {
      setError(mensaje(err))
    } finally {
      setOcupado(false)
    }
  }

  let principal: { texto: string; accion: () => void } | null = null
  if (estado === 'pagado' && conEnvio) principal = { texto: 'Marcar como enviado', accion: () => enviado.current?.showModal() }
  else if (estado === 'pagado' || estado === 'enviado') principal = { texto: 'Marcar como entregado', accion: () => void aplicar({ estado: 'entregado' }) }

  return (
    <section className="dp__seccion dp__seccion--acciones acciones" aria-labelledby="dp-acciones">
      <h2 id="dp-acciones" className="dp__subtitulo">
        Estado
      </h2>

      {principal && (
        <button type="button" className="adm-btn adm-btn--primario acciones__principal" disabled={ocupado} onClick={principal.accion}>
          {ocupado ? 'Guardando…' : principal.texto}
        </button>
      )}

      {estado === 'pendiente_pago' && <p className="acciones__nota">Esperando el pago de Mercado Pago. Pasa a «A preparar» solo cuando se aprueba.</p>}
      {(estado === 'cancelado' || estado === 'rechazado') && (
        <p className="acciones__nota">Este pedido está {NOMBRE_ESTADO[estado].toLowerCase()}: ya no cambia de estado.</p>
      )}

      {reponible && (
        <button type="button" className="adm-btn" disabled={ocupado} onClick={() => void aplicar({ reponerStock: true })}>
          {ocupado ? 'Devolviendo…' : 'Devolver los productos al stock'}
        </button>
      )}

      {correcciones.length > 0 && (
        <button type="button" className="adm-btn adm-btn--texto acciones__cambiar" disabled={ocupado} onClick={() => cambiar.current?.showModal()}>
          Cambiar estado…
        </button>
      )}

      {error && (
        <div className="adm-alerta" role="alert">
          {error}
        </div>
      )}

      {cancelable && (
        <div className="acciones__cancelar">
          <button type="button" className="adm-btn adm-btn--texto" disabled={ocupado} onClick={() => cancelar.current?.showModal()}>
            Cancelar pedido
          </button>
        </div>
      )}

      <DialogoEnviado ref={enviado} pedido={pedido} guardar={guardar} />
      <DialogoCambiar ref={cambiar} pedido={pedido} opciones={correcciones} guardar={guardar} />
      <DialogoCancelar ref={cancelar} pedido={pedido} guardar={guardar} />
    </section>
  )
}

type PropsDialogo = { ref: RefObject<HTMLDialogElement | null>; pedido: Pedido; guardar: Guardar }

/** Un `<dialog>` que no se cierra con Escape mientras guarda. */
function Dialogo({ ref, titulo, id, ocupado, alCerrar, children }: { ref: PropsDialogo['ref']; titulo: string; id: string; ocupado: boolean; alCerrar?: () => void; children: ReactNode }) {
  return (
    <dialog
      ref={ref}
      className="adm-dialogo acciones__dialogo"
      aria-labelledby={id}
      onCancel={(e) => {
        if (ocupado) e.preventDefault()
      }}
      onClose={alCerrar}
    >
      <h2 id={id} className="adm-dialogo-titulo">
        {titulo}
      </h2>
      {children}
    </dialog>
  )
}

/** "Marcar como enviado": pide (opcional) empresa y código, y después ofrece avisar por WhatsApp. */
function DialogoEnviado({ ref, pedido, guardar }: PropsDialogo) {
  const [empresa, setEmpresa] = useState(pedido.seguimiento?.empresa ?? '')
  const [codigo, setCodigo] = useState(pedido.seguimiento?.codigo ?? '')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [campos, setCampos] = useState<Record<string, string>>({})
  const [listo, setListo] = useState<Pedido | null>(null)

  function reiniciar() {
    setEmpresa(pedido.seguimiento?.empresa ?? '')
    setCodigo(pedido.seguimiento?.codigo ?? '')
    setError(null)
    setCampos({})
    setListo(null)
  }

  async function enviar(e: FormEvent) {
    e.preventDefault()
    setGuardando(true)
    setError(null)
    setCampos({})
    try {
      const conSeguimiento = empresa || codigo.trim()
      setListo(await guardar({ estado: 'enviado', ...(conSeguimiento && { seguimiento: { empresa, codigo } }) }))
    } catch (err) {
      setError(mensaje(err))
      if (err instanceof ErrorApi) setCampos(err.campos)
    } finally {
      setGuardando(false)
    }
  }

  const errEmpresa = campos['seguimiento.empresa']
  const errCodigo = campos['seguimiento.codigo']

  return (
    <Dialogo ref={ref} id="ac-enviado" titulo={listo ? 'Listo, quedó como enviado' : 'Marcar como enviado'} ocupado={guardando} alCerrar={reiniciar}>
      {listo ? (
        <>
          <p>¿Le avisás al comprador por WhatsApp? Se abre con el mensaje «Pedido enviado», y lo podés editar antes de mandarlo.</p>
          <div className="adm-dialogo-botones">
            <button type="button" className="adm-btn" onClick={() => ref.current?.close()}>
              Ahora no
            </button>
            <a
              className="adm-btn adm-btn--amarillo"
              href={linkWhatsapp(listo.cliente.celular, mensajePlantilla('enviado', listo, {}))}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => ref.current?.close()}
            >
              Abrir WhatsApp
            </a>
          </div>
        </>
      ) : (
        <form onSubmit={enviar} noValidate className="acciones__form">
          <p>Si ya tenés el seguimiento, cargalo. Si no, lo podés agregar después.</p>
          <div className="campo">
            <label htmlFor="ac-empresa" className="campo__label">
              Empresa <span className="campo__opcional">(opcional)</span>
            </label>
            <select
              id="ac-empresa"
              className="campo__input"
              value={empresa}
              aria-invalid={errEmpresa ? true : undefined}
              aria-describedby={errEmpresa ? 'ac-empresa-error' : undefined}
              onChange={(e) => setEmpresa(e.target.value)}
            >
              <option value="">Sin seguimiento</option>
              {EMPRESAS.map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
            {errEmpresa && (
              <p id="ac-empresa-error" className="adm-error-campo">
                {errEmpresa}
              </p>
            )}
          </div>
          <div className="campo">
            <label htmlFor="ac-codigo" className="campo__label">
              Código de seguimiento <span className="campo__opcional">(opcional)</span>
            </label>
            <input
              id="ac-codigo"
              className="campo__input"
              value={codigo}
              maxLength={40}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              aria-invalid={errCodigo ? true : undefined}
              aria-describedby={errCodigo ? 'ac-codigo-error' : undefined}
              onChange={(e) => setCodigo(e.target.value)}
            />
            {errCodigo && (
              <p id="ac-codigo-error" className="adm-error-campo">
                {errCodigo}
              </p>
            )}
          </div>
          {error && (
            <div className="adm-alerta" role="alert">
              {error}
            </div>
          )}
          <div className="adm-dialogo-botones">
            <button type="button" className="adm-btn" disabled={guardando} onClick={() => ref.current?.close()}>
              Volver
            </button>
            <button type="submit" className="adm-btn adm-btn--primario" disabled={guardando}>
              {guardando ? 'Guardando…' : 'Marcar enviado'}
            </button>
          </div>
        </form>
      )}
    </Dialogo>
  )
}

/** "Cambiar estado…": los estados a los que se puede corregir. */
function DialogoCambiar({ ref, pedido, opciones, guardar }: PropsDialogo & { opciones: EstadoPedido[] }) {
  const [elegido, setElegido] = useState<EstadoPedido | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function enviar(e: FormEvent) {
    e.preventDefault()
    if (!elegido) return
    setGuardando(true)
    setError(null)
    try {
      await guardar({ estado: elegido })
      ref.current?.close()
    } catch (err) {
      setError(mensaje(err))
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Dialogo
      ref={ref}
      id="ac-cambiar"
      titulo="Cambiar estado"
      ocupado={guardando}
      alCerrar={() => {
        setElegido(null)
        setError(null)
      }}
    >
      <form onSubmit={enviar} className="acciones__form">
        <p>
          Ahora está en <strong>{NOMBRE_ESTADO[pedido.estado]}</strong>. Usalo para corregir un cambio hecho por error.
        </p>
        <fieldset className="acciones__opciones">
          <legend className="adm-oculto">Nuevo estado</legend>
          {opciones.map((o) => (
            <label key={o} className="acciones__opcion">
              <input type="radio" name="ac-estado" value={o} checked={elegido === o} onChange={() => setElegido(o)} />
              <span>{NOMBRE_ESTADO[o]}</span>
            </label>
          ))}
        </fieldset>
        {error && (
          <div className="adm-alerta" role="alert">
            {error}
          </div>
        )}
        <div className="adm-dialogo-botones">
          <button type="button" className="adm-btn" disabled={guardando} onClick={() => ref.current?.close()}>
            Volver
          </button>
          <button type="submit" className="adm-btn adm-btn--primario" disabled={guardando || !elegido}>
            {guardando ? 'Guardando…' : 'Cambiar'}
          </button>
        </div>
      </form>
    </Dialogo>
  )
}

/** "Cancelar pedido": avisa que no devuelve el dinero y ofrece devolver el stock. */
function DialogoCancelar({ ref, pedido, guardar }: PropsDialogo) {
  const conStock = pedido.stockDescontado && !pedido.stockRepuesto
  const [reponer, setReponer] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function confirmar() {
    setGuardando(true)
    setError(null)
    try {
      await guardar({ estado: 'cancelado', ...(conStock && { reponerStock: reponer }) })
      ref.current?.close()
    } catch (err) {
      setError(mensaje(err))
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Dialogo
      ref={ref}
      id="ac-cancelar"
      titulo="¿Cancelar el pedido?"
      ocupado={guardando}
      alCerrar={() => {
        setReponer(true)
        setError(null)
      }}
    >
      <p>
        <strong>Cancelar no devuelve el dinero:</strong> si ya cobraste, hacé la devolución desde Mercado Pago.
      </p>
      {conStock && (
        <label className="acciones__check">
          <input type="checkbox" checked={reponer} onChange={(e) => setReponer(e.target.checked)} />
          <span>Devolver los productos al stock</span>
        </label>
      )}
      {error && (
        <div className="adm-alerta" role="alert">
          {error}
        </div>
      )}
      <div className="adm-dialogo-botones">
        <button type="button" className="adm-btn" autoFocus disabled={guardando} onClick={() => ref.current?.close()}>
          Volver
        </button>
        <button type="button" className="adm-btn adm-btn--primario" disabled={guardando} onClick={() => void confirmar()}>
          {guardando ? 'Cancelando…' : 'Cancelar pedido'}
        </button>
      </div>
    </Dialogo>
  )
}
