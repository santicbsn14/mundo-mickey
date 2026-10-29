import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { apiGet, ErrorApi } from '../../lib/api.ts'
import { numeroPedido, pesos } from '../../lib/formato.ts'
import { ENTREGA_CORTA, fechaCorta, linkVencido, type EstadoPedido, type ListadoPedidos } from '../../lib/pedidosAdmin.ts'
import { useContextoPanel } from './contextoPanel.ts'
import EtiquetaEstado from './EtiquetaEstado.tsx'
import './ListaPedidos.css'

/** Estado del detalle: desde dónde se abrió, para que "← Pedidos" vuelva al mismo filtro. */
export interface EstadoDetalle {
  desde?: string
}

interface Chip {
  /** Valor de `?estado=` (sin el parámetro: `pagado`). */
  clave: string
  texto: string
  /** Lo que se le pide a la API. */
  estados: EstadoPedido[] | 'todos'
  vacio: string
}

const CHIPS: Chip[] = [
  { clave: 'pagado', texto: 'A preparar', estados: ['pagado'], vacio: 'No hay pedidos para preparar.' },
  { clave: 'enviado', texto: 'Enviados', estados: ['enviado'], vacio: 'No hay pedidos enviados.' },
  { clave: 'entregado', texto: 'Entregados', estados: ['entregado'], vacio: 'No hay pedidos entregados.' },
  { clave: 'pendiente_pago', texto: 'Pendientes de pago', estados: ['pendiente_pago'], vacio: 'No hay pedidos pendientes de pago.' },
  { clave: 'cancelado', texto: 'Cancelados', estados: ['cancelado', 'rechazado'], vacio: 'No hay pedidos cancelados.' },
  { clave: 'todos', texto: 'Todos', estados: 'todos', vacio: 'Todavía no hay pedidos.' },
]

const RETARDO_BUSQUEDA = 350
const mensaje = (err: unknown) => (err instanceof ErrorApi ? err.message : 'Algo salió mal. Probá de nuevo.')

function contar(chip: Chip, conteos: ListadoPedidos['conteos']) {
  if (chip.estados === 'todos') return Object.values(conteos).reduce((s, n) => s + n, 0)
  return chip.estados.reduce((s, e) => s + (conteos[e] ?? 0), 0)
}

export default function ListaPedidos() {
  const { search } = useLocation()
  const [params, setParams] = useSearchParams()
  const { setAPreparar } = useContextoPanel()

  const chip = CHIPS.find((c) => c.clave === params.get('estado')) ?? CHIPS[0]!
  const q = params.get('q') ?? ''
  const pagina = Math.max(1, Number.parseInt(params.get('pagina') ?? '', 10) || 1)

  const [datos, setDatos] = useState<ListadoPedidos | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const pedido = useRef(0)

  // Lo que se escribe en el buscador; pasa a la URL con un pequeño retardo
  const [texto, setTexto] = useState(q)
  // "Atrás" o un link cambian la búsqueda (sin pisar un espacio que se está escribiendo)
  useEffect(() => setTexto((t) => (t.trim() === q ? t : q)), [q])

  const cambiarParams = useCallback(
    (cambios: Record<string, string | null>, opciones?: { replace?: boolean }) => {
      setParams((prev) => {
        const nuevos = new URLSearchParams(prev)
        for (const [k, v] of Object.entries(cambios)) {
          if (v) nuevos.set(k, v)
          else nuevos.delete(k)
        }
        return nuevos
      }, opciones)
    },
    [setParams],
  )

  useEffect(() => {
    const limpio = texto.trim()
    if (limpio === q) return
    const id = window.setTimeout(() => cambiarParams({ q: limpio || null, pagina: null }, { replace: true }), RETARDO_BUSQUEDA)
    return () => window.clearTimeout(id)
  }, [texto, q, cambiarParams])

  const cargar = useCallback(async () => {
    const este = ++pedido.current
    setCargando(true)
    setError(null)
    const consulta = new URLSearchParams({
      estado: chip.estados === 'todos' ? 'todos' : chip.estados.join(','),
      pagina: String(pagina),
    })
    if (q) consulta.set('q', q)
    try {
      const r = await apiGet<ListadoPedidos>(`/admin/pedidos?${consulta}`)
      if (este !== pedido.current) return
      setDatos(r)
      // Sin búsqueda, el conteo de "A preparar" es el total: actualiza la barra
      if (!q) setAPreparar(r.conteos.pagado)
    } catch (err) {
      if (este === pedido.current) setError(mensaje(err))
    } finally {
      if (este === pedido.current) setCargando(false)
    }
  }, [chip, pagina, q, setAPreparar])

  useEffect(() => {
    void cargar()
  }, [cargar])

  const lista = datos?.pedidos ?? []

  return (
    <section className="lpd" aria-labelledby="lpd-titulo">
      <h1 id="lpd-titulo" className="adm-titulo">
        Pedidos
      </h1>

      <div className="lpd__buscar">
        <label htmlFor="lpd-q" className="adm-oculto">
          Buscar pedidos
        </label>
        <input
          id="lpd-q"
          type="search"
          className="campo__input"
          placeholder="Buscar por número, nombre, DNI…"
          value={texto}
          maxLength={100}
          autoComplete="off"
          enterKeyHint="search"
          onChange={(e) => setTexto(e.target.value)}
        />
      </div>

      <nav className="lpd__chips" aria-label="Filtrar por estado">
        {CHIPS.map((c) => {
          const activo = c === chip
          const n = datos ? contar(c, datos.conteos) : null
          return (
            <button
              key={c.clave}
              type="button"
              className="lpd__chip"
              aria-pressed={activo}
              onClick={() => !activo && cambiarParams({ estado: c.clave === 'pagado' ? null : c.clave, pagina: null })}
            >
              {c.texto}
              {n !== null && <span className="lpd__conteo">{n}</span>}
            </button>
          )
        })}
      </nav>

      {error ? (
        <div className="adm-estado-error">
          <div className="adm-alerta" role="alert">
            No se pudieron cargar los pedidos. {error}
          </div>
          <button type="button" className="adm-btn" onClick={() => void cargar()}>
            Reintentar
          </button>
        </div>
      ) : !datos ? (
        <p className="adm-estado" role="status">
          Cargando pedidos…
        </p>
      ) : (
        <div className={`lpd__resultados${cargando ? ' lpd__resultados--cargando' : ''}`} aria-busy={cargando}>
          {lista.length === 0 ? (
            <p className="lpd__vacio">{q ? `No encontramos pedidos con «${q}».` : chip.vacio}</p>
          ) : (
            <ul className="lpd__lista">
              {lista.map((p) => {
                const estado: EstadoDetalle = { desde: search }
                return (
                  <li key={p._id} className={`lpd__tarjeta lpd__tarjeta--${p.estado}`}>
                    <div className="lpd__arriba">
                      {/* El link se estira sobre toda la tarjeta */}
                      <Link to={`/admin/pedidos/${p._id}`} state={estado} className="lpd__numero">
                        {numeroPedido(p.numero)}
                        <span className="adm-oculto">
                          , {p.nombre} {p.apellido}
                        </span>
                      </Link>
                      <span className="lpd__fecha">{fechaCorta(p.fecha)}</span>
                    </div>
                    <p className="lpd__nombre">
                      {p.nombre} {p.apellido}
                    </p>
                    <p className="lpd__datos">
                      <span className="lpd__total">{pesos(p.total)}</span>
                      <span>{ENTREGA_CORTA[p.tipoEntrega]}</span>
                      <span>{p.cantidad === 1 ? '1 producto' : `${p.cantidad} productos`}</span>
                    </p>
                    <p className="lpd__rotulos">
                      <EtiquetaEstado estado={p.estado} />
                      {p.revisar && <span className="adm-rotulo adm-rotulo--negro">⚠ Revisar</span>}
                      {linkVencido(p.estado, p.fecha) && <span className="adm-rotulo adm-rotulo--hueco">Link vencido</span>}
                    </p>
                  </li>
                )
              })}
            </ul>
          )}

          {datos.paginas > 1 && (
            <nav className="lpd__paginas" aria-label="Páginas">
              <button
                type="button"
                className="adm-btn"
                disabled={pagina <= 1 || cargando}
                onClick={() => cambiarParams({ pagina: pagina - 1 > 1 ? String(pagina - 1) : null })}
              >
                ← Anteriores
              </button>
              <span className="lpd__pagina">
                Página {datos.pagina} de {datos.paginas}
              </span>
              <button
                type="button"
                className="adm-btn"
                disabled={pagina >= datos.paginas || cargando}
                onClick={() => cambiarParams({ pagina: String(pagina + 1) })}
              >
                Siguientes →
              </button>
            </nav>
          )}
        </div>
      )}
    </section>
  )
}
