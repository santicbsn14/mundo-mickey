import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { apiGet, apiPatch, ErrorApi } from '../../lib/api.ts'
import { costoEnvio, numeroPedido, pesos } from '../../lib/formato.ts'
import {
  EMPRESAS,
  ENTREGA_LARGA,
  estadoPago,
  fechaCompleta,
  fechaCorta,
  lineaCalle,
  lineasRevisar,
  NOMBRE_ESTADO,
  pedidoDelError,
  textoEtiqueta,
  type CambiosPedido,
  type Pedido,
} from '../../lib/pedidosAdmin.ts'
import { miniatura } from '../../lib/productosAdmin.ts'
import AccionesPedido from './AccionesPedido.tsx'
import ContactoPedido from './ContactoPedido.tsx'
import { useContextoPanel } from './contextoPanel.ts'
import EtiquetaEstado from './EtiquetaEstado.tsx'
import type { EstadoDetalle } from './ListaPedidos.tsx'
import './DetallePedido.css'

const MAX_NOTA = 2000
const MAX_CODIGO = 40
const mensaje = (err: unknown) => (err instanceof ErrorApi ? err.message : 'Algo salió mal. Probá de nuevo.')

/** Guarda cambios y devuelve el pedido actualizado. Tira el `ErrorApi` si falla (para mostrarlo donde corresponde). */
export type Guardar = (cambios: CambiosPedido) => Promise<Pedido>

export default function DetallePedido({ id }: { id: string }) {
  const location = useLocation()
  const desde = (location.state as EstadoDetalle | null)?.desde ?? ''
  const { refrescarAPreparar } = useContextoPanel()

  const [pedido, setPedido] = useState<Pedido | null>(null)
  const [errorCarga, setErrorCarga] = useState<{ texto: string; noExiste: boolean } | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const idAviso = useRef(0)

  const cargar = useCallback(async () => {
    setErrorCarga(null)
    setPedido(null)
    try {
      setPedido(await apiGet<Pedido>(`/admin/pedidos/${id}`))
    } catch (err) {
      setErrorCarga({ texto: mensaje(err), noExiste: err instanceof ErrorApi && err.status === 404 })
    }
  }, [id])

  useEffect(() => {
    void cargar()
  }, [cargar])

  const avisar = useCallback((texto: string) => {
    const este = ++idAviso.current
    setAviso(texto)
    window.setTimeout(() => {
      if (idAviso.current === este) setAviso(null)
    }, 3500)
  }, [])

  const guardar = useCallback<Guardar>(
    async (cambios) => {
      try {
        const nuevo = await apiPatch<Pedido>(`/admin/pedidos/${id}`, cambios)
        setPedido(nuevo)
        avisar('Listo, se guardó.')
        if (cambios.estado) refrescarAPreparar()
        return nuevo
      } catch (err) {
        // Se canceló pero no se pudo devolver el stock: la API manda el pedido ya cancelado
        const cancelado = err instanceof ErrorApi ? pedidoDelError(err.datos) : null
        if (cancelado) {
          setPedido(cancelado)
          refrescarAPreparar()
        }
        throw err
      }
    },
    [id, avisar, refrescarAPreparar],
  )

  const volver = (
    <Link to={`/admin${desde}`} className="adm-btn adm-btn--texto dp__volver">
      ← Pedidos
    </Link>
  )

  if (errorCarga) {
    return (
      <section className="dp">
        {volver}
        {errorCarga.noExiste ? (
          <div className="admin-vacia">
            <h1>Este pedido no existe</h1>
            <p>Puede que el link esté mal copiado. Buscalo en el listado de pedidos.</p>
          </div>
        ) : (
          <div className="adm-estado-error">
            <div className="adm-alerta" role="alert">
              No se pudo cargar el pedido. {errorCarga.texto}
            </div>
            <button type="button" className="adm-btn" onClick={() => void cargar()}>
              Reintentar
            </button>
          </div>
        )}
      </section>
    )
  }

  if (!pedido) {
    return (
      <section className="dp">
        {volver}
        <p className="adm-estado" role="status">
          Cargando pedido…
        </p>
      </section>
    )
  }

  const alertas = lineasRevisar(pedido.notaInterna)
  const conEnvio = pedido.entrega.tipo !== 'retiro'

  return (
    <section className="dp" aria-labelledby="dp-titulo">
      {volver}

      {alertas.length > 0 && (
        <div className="adm-alerta dp__revisar" role="note">
          <p className="dp__revisar-titulo">⚠ Revisar este pedido</p>
          <ul>
            {alertas.map((l, i) => (
              <li key={i}>{l}</li>
            ))}
          </ul>
        </div>
      )}

      <header className="dp__cabecera">
        <h1 id="dp-titulo" className="dp__numero">
          Pedido {numeroPedido(pedido.numero)}
        </h1>
        <EtiquetaEstado estado={pedido.estado} grande />
        <p className="dp__fecha">{fechaCorta(pedido.createdAt)}</p>
      </header>

      {/* En el celular, una columna en el orden de las secciones (`order`); desde 900px, dos */}
      <div className="dp__columnas">
        <div className="dp__columna">
          <ContactoPedido pedido={pedido} />

          <section className="dp__seccion dp__seccion--entrega" aria-labelledby="dp-entrega">
            <h2 id="dp-entrega" className="dp__subtitulo">
              Entrega
            </h2>
            <p className="dp__tipo-entrega">{ENTREGA_LARGA[pedido.entrega.tipo]}</p>
            {pedido.entrega.direccion && (
              <>
                <address className="dp__direccion">
                  {lineaCalle(pedido.entrega.direccion)}
                  <br />
                  {pedido.entrega.direccion.codigoPostal} {pedido.entrega.direccion.localidad}, {pedido.entrega.direccion.provincia}
                </address>
                <CopiarTexto texto={textoEtiqueta(pedido)} etiqueta="Copiar dirección" hecho="Copiada" />
              </>
            )}
            {pedido.entrega.notas && (
              <div className="dp__notas">
                <p className="dp__rotulo-dato">Notas del comprador</p>
                <p>{pedido.entrega.notas}</p>
              </div>
            )}
          </section>

          {conEnvio && <FormSeguimiento key={`${pedido.seguimiento?.empresa}|${pedido.seguimiento?.codigo}`} pedido={pedido} guardar={guardar} />}

          <FormNota key={pedido.notaInterna ?? ''} pedido={pedido} guardar={guardar} />
        </div>

        <div className="dp__columna">
          <section className="dp__seccion dp__seccion--productos" aria-labelledby="dp-productos">
            <h2 id="dp-productos" className="dp__subtitulo">
              Productos
            </h2>
            <ul className="dp__items">
              {pedido.items.map((item, i) => (
                <li key={`${item.productoId}-${i}`} className="dp__item">
                  <Miniatura url={item.imagenUrl} />
                  <div className="dp__item-texto">
                    <p className="dp__item-nombre">{item.nombre}</p>
                    <p className="dp__item-cantidad">
                      {item.cantidad} × {pesos(item.precioUnitario)}
                    </p>
                  </div>
                  <p className="dp__item-subtotal">{pesos(item.cantidad * item.precioUnitario)}</p>
                </li>
              ))}
            </ul>
            <dl className="dp__montos">
              <div>
                <dt>Subtotal</dt>
                <dd>{pesos(pedido.subtotal)}</dd>
              </div>
              {conEnvio && (
                <div>
                  <dt>Envío</dt>
                  <dd>{pedido.entrega.tipo === 'envio_nacional' ? 'A coordinar' : costoEnvio(pedido.costoEnvio)}</dd>
                </div>
              )}
              <div className="dp__total">
                <dt>Total</dt>
                <dd>{pesos(pedido.total)}</dd>
              </div>
            </dl>
          </section>

          <section className="dp__seccion dp__seccion--pago" aria-labelledby="dp-pago">
            <h2 id="dp-pago" className="dp__subtitulo">
              Pago
            </h2>
            <dl className="dp__datos">
              <div>
                <dt>Mercado Pago</dt>
                <dd>{estadoPago(pedido.mp?.estadoPago)}</dd>
              </div>
              {pedido.mp?.pagoId && (
                <div>
                  <dt>Id del pago</dt>
                  <dd className="dp__pago-id">
                    <span>{pedido.mp.pagoId}</span>
                    <CopiarTexto texto={pedido.mp.pagoId} etiqueta="Copiar" hecho="Copiado" chico />
                  </dd>
                </div>
              )}
              <div>
                <dt>Stock</dt>
                <dd>
                  {pedido.stockRepuesto
                    ? 'Descontado y devuelto al cancelar'
                    : pedido.stockDescontado
                      ? 'Descontado'
                      : 'Sin descontar'}
                </dd>
              </div>
            </dl>
          </section>

          <AccionesPedido pedido={pedido} guardar={guardar} />

          <section className="dp__seccion dp__seccion--historial" aria-labelledby="dp-historial">
            <h2 id="dp-historial" className="dp__subtitulo">
              Historial
            </h2>
            <ol className="dp__historial">
              {pedido.historial.map((h, i) => (
                <li key={i}>
                  <span className="dp__historial-estado">{NOMBRE_ESTADO[h.estado]}</span>
                  <span className="dp__historial-fecha">{fechaCompleta(h.fecha)}</span>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </div>

      <div aria-live="polite" className="dp__vivo">
        {aviso && <p className="adm-toast">{aviso}</p>}
      </div>
    </section>
  )
}

/** Miniatura del producto, con un recuadro amarillo si no hay imagen o no carga. */
function Miniatura({ url }: { url?: string }) {
  const [fallo, setFallo] = useState(false)
  if (!url || fallo) return <span className="dp__item-foto dp__item-foto--vacia" aria-hidden="true">★</span>
  return <img className="dp__item-foto" src={miniatura(url, 128)} alt="" loading="lazy" onError={() => setFallo(true)} />
}

/**
 * Botón que copia un texto al portapapeles y muestra "Copiada" un momento. Si el portapapeles falla,
 * muestra el texto seleccionado para copiarlo a mano.
 */
export function CopiarTexto({ texto, etiqueta, hecho, chico = false }: { texto: string; etiqueta: string; hecho: string; chico?: boolean }) {
  const [copiado, setCopiado] = useState(false)
  const [manual, setManual] = useState(false)
  const area = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (!copiado) return
    const t = window.setTimeout(() => setCopiado(false), 2000)
    return () => window.clearTimeout(t)
  }, [copiado])

  useEffect(() => {
    if (manual) area.current?.select()
  }, [manual])

  async function copiar() {
    try {
      if (!navigator.clipboard) throw new Error('sin portapapeles')
      await navigator.clipboard.writeText(texto)
      setManual(false)
      setCopiado(true)
    } catch {
      setManual(true)
    }
  }

  return (
    <div className="copiar">
      <button type="button" className={`adm-btn${chico ? ' copiar__chico' : ''}`} onClick={() => void copiar()}>
        {copiado ? `✓ ${hecho}` : etiqueta}
      </button>
      <span className="adm-oculto" aria-live="polite">
        {copiado ? hecho : ''}
      </span>
      {manual && (
        <div className="copiar__manual">
          <p>No se pudo copiar solo. Está seleccionado: copialo a mano.</p>
          <textarea
            ref={area}
            className="campo__input campo__textarea"
            readOnly
            value={texto}
            rows={texto.split('\n').length}
            aria-label="Texto para copiar"
            onFocus={(e) => e.target.select()}
          />
        </div>
      )}
    </div>
  )
}

/** Empresa y código de seguimiento, con "Guardar". */
function FormSeguimiento({ pedido, guardar }: { pedido: Pedido; guardar: Guardar }) {
  const [empresa, setEmpresa] = useState(pedido.seguimiento?.empresa ?? '')
  const [codigo, setCodigo] = useState(pedido.seguimiento?.codigo ?? '')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [campos, setCampos] = useState<Record<string, string>>({})
  const sinCambios = empresa === (pedido.seguimiento?.empresa ?? '') && codigo.trim() === (pedido.seguimiento?.codigo ?? '')

  async function enviar(e: FormEvent) {
    e.preventDefault()
    setGuardando(true)
    setError(null)
    setCampos({})
    try {
      await guardar({ seguimiento: { empresa, codigo } })
    } catch (err) {
      setError(mensaje(err))
      if (err instanceof ErrorApi) setCampos(err.campos)
      setGuardando(false)
    }
  }

  const errEmpresa = campos['seguimiento.empresa'] ?? campos.seguimiento
  const errCodigo = campos['seguimiento.codigo']

  return (
    <section className="dp__seccion dp__seccion--seguimiento" aria-labelledby="dp-seguimiento">
      <h2 id="dp-seguimiento" className="dp__subtitulo">
        Seguimiento
      </h2>
      <form className="dp__form" onSubmit={enviar} noValidate>
        <div className="campo">
          <label htmlFor="dp-empresa" className="campo__label">
            Empresa
          </label>
          <select
            id="dp-empresa"
            className="campo__input"
            value={empresa}
            aria-invalid={errEmpresa ? true : undefined}
            aria-describedby={errEmpresa ? 'dp-empresa-error' : undefined}
            onChange={(e) => setEmpresa(e.target.value)}
          >
            <option value="">Sin seguimiento</option>
            {EMPRESAS.map((e) => (
              <option key={e}>{e}</option>
            ))}
          </select>
          {errEmpresa && (
            <p id="dp-empresa-error" className="adm-error-campo">
              {errEmpresa}
            </p>
          )}
        </div>
        <div className="campo">
          <label htmlFor="dp-codigo" className="campo__label">
            Código <span className="campo__opcional">(opcional)</span>
          </label>
          <input
            id="dp-codigo"
            className="campo__input"
            value={codigo}
            maxLength={MAX_CODIGO}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            aria-invalid={errCodigo ? true : undefined}
            aria-describedby={errCodigo ? 'dp-codigo-error' : undefined}
            onChange={(e) => setCodigo(e.target.value)}
          />
          {errCodigo && (
            <p id="dp-codigo-error" className="adm-error-campo">
              {errCodigo}
            </p>
          )}
        </div>
        {error && (
          <div className="adm-alerta" role="alert">
            {error}
          </div>
        )}
        <button type="submit" className="adm-btn adm-btn--primario" disabled={guardando || sinCambios}>
          {guardando ? 'Guardando…' : 'Guardar'}
        </button>
      </form>
    </section>
  )
}

/** La nota interna, con "Guardar nota". */
function FormNota({ pedido, guardar }: { pedido: Pedido; guardar: Guardar }) {
  const [nota, setNota] = useState(pedido.notaInterna ?? '')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const sinCambios = nota.trim() === (pedido.notaInterna ?? '')

  async function enviar(e: FormEvent) {
    e.preventDefault()
    setGuardando(true)
    setError(null)
    try {
      await guardar({ notaInterna: nota })
    } catch (err) {
      setError(err instanceof ErrorApi ? (err.campos.notaInterna ?? err.message) : mensaje(err))
      setGuardando(false)
    }
  }

  return (
    <section className="dp__seccion dp__seccion--nota" aria-labelledby="dp-nota">
      <h2 id="dp-nota" className="dp__subtitulo">
        Nota interna
      </h2>
      <form className="dp__form" onSubmit={enviar} noValidate>
        <div className="campo">
          <div className="campo__fila">
            <label htmlFor="dp-nota-texto" className="adm-oculto">
              Nota interna
            </label>
            <p id="dp-nota-ayuda" className="campo__ayuda">
              Solo la ves vos. Acá también aparecen los avisos automáticos del sistema.
            </p>
            <span className="campo__contador" aria-hidden="true">
              {nota.length}/{MAX_NOTA}
            </span>
          </div>
          <textarea
            id="dp-nota-texto"
            className="campo__input campo__textarea dp__nota"
            value={nota}
            maxLength={MAX_NOTA}
            rows={4}
            aria-describedby={`dp-nota-ayuda${error ? ' dp-nota-error' : ''}`}
            aria-invalid={error ? true : undefined}
            onChange={(e) => setNota(e.target.value)}
          />
          {error && (
            <p id="dp-nota-error" className="adm-error-campo" role="alert">
              {error}
            </p>
          )}
        </div>
        <button type="submit" className="adm-btn adm-btn--primario" disabled={guardando || sinCambios}>
          {guardando ? 'Guardando…' : 'Guardar nota'}
        </button>
      </form>
    </section>
  )
}
