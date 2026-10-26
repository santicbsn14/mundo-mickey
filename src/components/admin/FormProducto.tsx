import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type MouseEvent } from 'react'
import { flushSync } from 'react-dom'
import { Link, useNavigate } from 'react-router-dom'
import { apiDelete, apiPost, apiPut, ErrorApi } from '../../lib/api.ts'
import { pesos } from '../../lib/formato.ts'
import {
  AVISO_CDN,
  type CuerpoProducto,
  type EstadoListado,
  type ImagenAdmin,
  type ProductoAdmin,
} from '../../lib/productosAdmin.ts'
import SubidorImagenes, { type EstadoSubidas } from './SubidorImagenes.tsx'
import './FormProducto.css'

const SUGERENCIAS_ETIQUETA = ['Nuevo', 'El más pedido', 'Últimas unidades']

// En el orden en que aparecen: el foco va al primero con error
const CAMPOS = ['imagenes', 'nombre', 'descripcion', 'precio', 'stock', 'badge', 'destacado', 'activo'] as const
type Campo = (typeof CAMPOS)[number]
const idCampo = (c: Campo) => `fp-${c}`
const idError = (c: Campo) => `fp-${c}-error`

interface Valores {
  imagenes: ImagenAdmin[]
  nombre: string
  descripcion: string
  /** Como lo escribieron: acepta `34900` o `34.900`. */
  precio: string
  stock: string
  badge: string
  destacado: boolean
  activo: boolean
}

function valoresIniciales(p?: ProductoAdmin): Valores {
  return {
    imagenes: p?.imagenes ?? [],
    nombre: p?.nombre ?? '',
    descripcion: p?.descripcion ?? '',
    precio: p ? pesos(p.precio).slice(1) : '', // 26400 → "26.400", como lo escribiría el dueño
    stock: p ? String(p.stock) : '1',
    badge: p?.badge ?? '',
    destacado: p?.destacado ?? false,
    activo: p?.activo ?? true,
  }
}

/** `34.900` o `34900` → 34900. Cualquier otra cosa → `null` (la API responde con el error del campo). */
function aEntero(texto: string): number | null {
  const limpio = texto.replace(/[.\s]/g, '')
  return /^\d+$/.test(limpio) ? Number(limpio) : null
}

function cuerpo(v: Valores): CuerpoProducto {
  return {
    nombre: v.nombre,
    descripcion: v.descripcion,
    precio: aEntero(v.precio),
    stock: aEntero(v.stock),
    imagenes: v.imagenes.map((img) => img._ref),
    badge: v.badge,
    destacado: v.destacado,
    activo: v.activo,
  }
}

interface Props {
  /** El producto a editar; sin producto, el formulario es para crear uno. */
  producto?: ProductoAdmin
}

export default function FormProducto({ producto }: Props) {
  const navigate = useNavigate()
  const editando = !!producto

  const inicial = useMemo(() => valoresIniciales(producto), [producto])
  const [v, setV] = useState<Valores>(inicial)
  const [errores, setErrores] = useState<Partial<Record<Campo, string>>>({})
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [subidas, setSubidas] = useState<EstadoSubidas>({ subiendo: false, fallidas: 0 })
  const alerta = useRef<HTMLDivElement>(null)

  const cambiado = JSON.stringify(v) !== JSON.stringify(inicial) || subidas.subiendo || subidas.fallidas > 0
  // Al guardar o eliminar se sale del formulario: no tiene que preguntar
  const saliendo = useRef(false)

  useEffect(() => {
    if (!cambiado) return
    const avisar = (e: BeforeUnloadEvent) => {
      if (saliendo.current) return
      e.preventDefault()
      e.returnValue = '' // navegadores viejos
    }
    window.addEventListener('beforeunload', avisar)
    return () => window.removeEventListener('beforeunload', avisar)
  }, [cambiado])

  const onEstadoSubidas = useCallback((e: EstadoSubidas) => setSubidas(e), [])

  function cambiar<K extends keyof Valores>(campo: K, valor: Valores[K]) {
    setV((anterior) => ({ ...anterior, [campo]: valor }))
    if (errores[campo]) setErrores(({ [campo]: _, ...resto }) => resto)
  }

  /** Muestra los errores y lleva el foco al primer campo con error (o a la alerta general). */
  function mostrarErrores(campos: Partial<Record<Campo, string>>, general: string | null) {
    flushSync(() => {
      setErrores(campos)
      setErrorGeneral(general)
    })
    const primero = CAMPOS.find((c) => campos[c])
    const destino = primero ? document.getElementById(idCampo(primero)) : alerta.current
    destino?.focus()
    destino?.scrollIntoView({ block: 'center' })
  }

  async function guardar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (guardando || subidas.subiendo) return

    // Lo básico, para no mandar algo vacío. El resto lo valida la API.
    const basicos: Partial<Record<Campo, string>> = {}
    if (!v.imagenes.length) basicos.imagenes = 'Subí al menos una foto.'
    if (!v.nombre.trim()) basicos.nombre = 'El nombre es obligatorio.'
    if (Object.keys(basicos).length) return mostrarErrores(basicos, 'Revisá los datos del producto.')
    if (subidas.fallidas) {
      return mostrarErrores({ imagenes: 'Hay fotos que no se subieron: reintentá o quitalas.' }, 'Revisá los datos del producto.')
    }

    setGuardando(true)
    setErrorGeneral(null)
    try {
      const guardado = editando
        ? await apiPut<ProductoAdmin>(`/admin/productos/${producto._id}`, cuerpo(v))
        : await apiPost<ProductoAdmin>('/admin/productos', cuerpo(v))
      saliendo.current = true
      const estado: EstadoListado = { aviso: `Listo, se guardó «${guardado.nombre}». ${AVISO_CDN}` }
      navigate('/admin/productos', { state: estado })
    } catch (err) {
      setGuardando(false)
      if (err instanceof ErrorApi) {
        const campos: Partial<Record<Campo, string>> = {}
        for (const c of CAMPOS) if (err.campos[c]) campos[c] = err.campos[c]
        mostrarErrores(campos, err.message)
      } else {
        mostrarErrores({}, 'No se pudo guardar. Probá de nuevo.')
      }
    }
  }

  function volver(e: MouseEvent<HTMLAnchorElement>) {
    if (cambiado && !window.confirm('Tenés cambios sin guardar. ¿Salir igual?')) e.preventDefault()
  }

  const precio = aEntero(v.precio)
  const stock = aEntero(v.stock)
  const props = (c: Campo) => ({
    id: idCampo(c),
    'aria-invalid': errores[c] ? true : undefined,
    'aria-describedby': errores[c] ? idError(c) : undefined,
  })
  const error = (c: Campo) =>
    errores[c] && (
      <p id={idError(c)} className="adm-error-campo">
        {errores[c]}
      </p>
    )

  return (
    <div className="fp">
      <div className="fp__cabecera">
        <Link to="/admin/productos" className="fp__volver" onClick={volver}>
          ← Volver
        </Link>
        <h1 className="adm-titulo">{editando ? 'Editar producto' : 'Nuevo producto'}</h1>
        {editando && (
          <p className="fp__tienda">
            <a href={`/producto/${producto.slug}`} target="_blank" rel="noopener">
              Ver en la tienda ↗
            </a>
            {!producto.activo && <span> (está oculto: en la tienda no se ve)</span>}
          </p>
        )}
      </div>

      <form className="fp__form" onSubmit={guardar} noValidate>
        <div className="fp__columnas">
          <fieldset className="fp__fotos campo">
            <legend className="campo__label">Fotos</legend>
            <SubidorImagenes
              imagenes={v.imagenes}
              onChange={(imagenes) => cambiar('imagenes', imagenes)}
              onEstado={onEstadoSubidas}
              error={errores.imagenes}
              idBoton={idCampo('imagenes')}
            />
          </fieldset>

          <div className="fp__datos">
            <div className="campo">
              <label className="campo__label" htmlFor={idCampo('nombre')}>
                Nombre
              </label>
              <input
                {...props('nombre')}
                className="campo__input"
                maxLength={80}
                autoComplete="off"
                value={v.nombre}
                onChange={(e) => cambiar('nombre', e.target.value)}
              />
              {error('nombre')}
            </div>

            <div className="campo">
              <div className="campo__fila">
                <label className="campo__label" htmlFor={idCampo('descripcion')}>
                  Descripción
                </label>
                <span className="campo__contador" aria-live="polite">
                  {v.descripcion.length}/300
                </span>
              </div>
              <textarea
                {...props('descripcion')}
                className="campo__input campo__textarea"
                maxLength={300}
                rows={3}
                value={v.descripcion}
                onChange={(e) => cambiar('descripcion', e.target.value)}
              />
              {error('descripcion')}
            </div>

            <div className="campo">
              <label className="campo__label" htmlFor={idCampo('precio')}>
                Precio
              </label>
              <div className="campo__precio">
                <span aria-hidden="true">$</span>
                <input
                  {...props('precio')}
                  className="campo__input"
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="34.900"
                  value={v.precio}
                  onChange={(e) => cambiar('precio', e.target.value.replace(/[^\d.]/g, ''))}
                />
              </div>
              <p className="campo__ayuda" aria-live="polite">
                {precio ? `En la tienda: ${pesos(precio)}` : 'Escribilo sin centavos, por ejemplo 34900 o 34.900.'}
              </p>
              {error('precio')}
            </div>

            <div className="campo">
              <label className="campo__label" htmlFor={idCampo('stock')}>
                Stock
              </label>
              <div className="campo__stock">
                <button
                  type="button"
                  className="adm-btn"
                  aria-label="Restar 1 al stock"
                  disabled={stock === null || stock <= 0}
                  onClick={() => cambiar('stock', String(Math.max(0, (stock ?? 0) - 1)))}
                >
                  −
                </button>
                <input
                  {...props('stock')}
                  className="campo__input"
                  inputMode="numeric"
                  autoComplete="off"
                  value={v.stock}
                  onChange={(e) => cambiar('stock', e.target.value.replace(/\D/g, ''))}
                />
                <button
                  type="button"
                  className="adm-btn"
                  aria-label="Sumar 1 al stock"
                  onClick={() => cambiar('stock', String((stock ?? 0) + 1))}
                >
                  +
                </button>
              </div>
              {error('stock')}
            </div>

            <div className="campo">
              <label className="campo__label" htmlFor={idCampo('badge')}>
                Etiqueta <span className="campo__opcional">(opcional)</span>
              </label>
              <input
                {...props('badge')}
                className="campo__input"
                maxLength={24}
                autoComplete="off"
                value={v.badge}
                onChange={(e) => cambiar('badge', e.target.value)}
              />
              <div className="campo__sugerencias" role="group" aria-label="Sugerencias de etiqueta">
                {SUGERENCIAS_ETIQUETA.map((s) => (
                  <button
                    key={s}
                    type="button"
                    className="adm-btn campo__sugerencia"
                    aria-pressed={v.badge === s}
                    onClick={() => cambiar('badge', v.badge === s ? '' : s)}
                  >
                    {s}
                  </button>
                ))}
              </div>
              {error('badge')}
            </div>

            <div className="campo">
              <label className="interruptor">
                <input
                  {...props('destacado')}
                  type="checkbox"
                  role="switch"
                  checked={v.destacado}
                  onChange={(e) => cambiar('destacado', e.target.checked)}
                />
                <span className="interruptor__pista" aria-hidden="true" />
                <span className="interruptor__texto">
                  <span className="campo__label">Destacado</span>
                  <span className="campo__ayuda">
                    Se muestra grande en la tienda. Solo puede haber uno: si lo marcás, se desmarca el anterior.
                  </span>
                </span>
              </label>
              {error('destacado')}
            </div>

            <div className="campo">
              <label className="interruptor">
                <input
                  {...props('activo')}
                  type="checkbox"
                  role="switch"
                  checked={v.activo}
                  onChange={(e) => cambiar('activo', e.target.checked)}
                />
                <span className="interruptor__pista" aria-hidden="true" />
                <span className="interruptor__texto">
                  <span className="campo__label">Visible en la tienda</span>
                  <span className="campo__ayuda">Si lo apagás, el producto se oculta pero no se borra.</span>
                </span>
              </label>
              {error('activo')}
            </div>
          </div>
        </div>

        {/* Fijo abajo mientras se recorre el formulario */}
        <div className="adm-barra-guardar">
          {errorGeneral && (
            <div ref={alerta} className="adm-alerta" role="alert" tabIndex={-1}>
              {errorGeneral}
            </div>
          )}
          <button type="submit" className="adm-btn adm-btn--primario adm-guardar" disabled={guardando || subidas.subiendo}>
            {guardando ? 'Guardando…' : subidas.subiendo ? 'Esperá a que suban las fotos…' : 'Guardar'}
          </button>
        </div>
      </form>

      {editando && <Eliminar producto={producto} alEliminar={() => (saliendo.current = true)} />}
    </div>
  )
}

/** "Eliminar producto", al final y con confirmación en un `<dialog>`. */
function Eliminar({ producto, alEliminar }: { producto: ProductoAdmin; alEliminar: () => void }) {
  const navigate = useNavigate()
  const dialogo = useRef<HTMLDialogElement>(null)
  const [eliminando, setEliminando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function abrir() {
    setError(null)
    dialogo.current?.showModal()
  }

  async function eliminar() {
    setEliminando(true)
    setError(null)
    try {
      await apiDelete(`/admin/productos/${producto._id}`)
      alEliminar()
      dialogo.current?.close()
      const estado: EstadoListado = { aviso: `Se eliminó «${producto.nombre}».` }
      navigate('/admin/productos', { state: estado })
    } catch (err) {
      setEliminando(false)
      setError(err instanceof ErrorApi ? err.message : 'No se pudo eliminar. Probá de nuevo.')
    }
  }

  return (
    <div className="fp__eliminar">
      <button type="button" className="adm-btn adm-btn--texto" onClick={abrir}>
        Eliminar producto
      </button>

      <dialog
        ref={dialogo}
        className="fp__dialogo"
        aria-labelledby="fp-eliminar-titulo"
        onCancel={(e) => {
          if (eliminando) e.preventDefault()
        }}
      >
        <h2 id="fp-eliminar-titulo" className="fp__dialogo-titulo">
          ¿Eliminar «{producto.nombre}»?
        </h2>
        <p>
          No se puede deshacer. Si solo querés que no aparezca en la tienda, apagá «Visible en la tienda».
        </p>
        {error && (
          <div className="adm-alerta" role="alert">
            {error}
          </div>
        )}
        <div className="fp__dialogo-botones">
          <button type="button" className="adm-btn" autoFocus disabled={eliminando} onClick={() => dialogo.current?.close()}>
            Cancelar
          </button>
          <button type="button" className="adm-btn adm-btn--primario" disabled={eliminando} onClick={eliminar}>
            {eliminando ? 'Eliminando…' : 'Eliminar'}
          </button>
        </div>
      </dialog>
    </div>
  )
}
