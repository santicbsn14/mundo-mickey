import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { apiSubir, ErrorApi } from '../../lib/api.ts'
import { comprimirImagen, MENSAJE_FOTO_ILEGIBLE } from '../../lib/imagenes.ts'
import { miniatura, type ImagenAdmin } from '../../lib/productosAdmin.ts'
import './SubidorImagenes.css'

export const MAX_FOTOS = 8

/** Cómo van las fotos que todavía no están en la lista. */
export interface EstadoSubidas {
  /** Hay fotos en espera, comprimiéndose o subiéndose. */
  subiendo: boolean
  /** Fotos que fallaron y siguen en pantalla (con "Reintentar" y "Quitar"). */
  fallidas: number
}

/** Una foto elegida que todavía no se subió. Va con una vista previa local (object URL). */
interface Pendiente {
  id: number
  archivo: File
  previa: string
  estado: 'esperando' | 'preparando' | 'subiendo' | 'error'
  /** Ya comprimida: si falla la subida, el reintento no la vuelve a comprimir. */
  blob?: Blob
  error?: string
  /** No se pudo leer: reintentar no sirve. */
  ilegible?: boolean
}

const TEXTO_ESTADO: Record<Exclude<Pendiente['estado'], 'error'>, string> = {
  esperando: 'En espera…',
  preparando: 'Preparando…',
  subiendo: 'Subiendo…',
}

interface Props {
  /** Las fotos ya subidas, en orden. La primera es la portada. */
  imagenes: ImagenAdmin[]
  onChange: (imagenes: ImagenAdmin[]) => void
  onEstado?: (estado: EstadoSubidas) => void
  /** Error de la API para el campo `imagenes`. */
  error?: string
  /** id del botón "Agregar fotos", para que el formulario le pueda dar el foco. */
  idBoton?: string
}

/** Precarga la URL de Sanity, así la miniatura no queda en blanco al cambiar la vista previa local por la real. */
function precargar(url: string) {
  return new Promise<void>((resolve) => {
    const img = new Image()
    img.onload = img.onerror = () => resolve()
    img.src = url
    setTimeout(resolve, 8000)
  })
}

export default function SubidorImagenes({ imagenes, onChange, onEstado, error, idBoton }: Props) {
  const input = useRef<HTMLInputElement>(null)
  const [aviso, setAviso] = useState<string | null>(null)

  // Las pendientes se leen desde la cola (async), así que van también en un ref
  const [pendientes, setPendientesEstado] = useState<Pendiente[]>([])
  const pendRef = useRef<Pendiente[]>([])
  const setPendientes = (cambiar: (actuales: Pendiente[]) => Pendiente[]) => {
    pendRef.current = cambiar(pendRef.current)
    setPendientesEstado(pendRef.current)
  }
  const actualizar = (id: number, cambios: Partial<Pendiente>) =>
    setPendientes((ps) => ps.map((p) => (p.id === id ? { ...p, ...cambios } : p)))

  // La lista más reciente, para sumar al final aunque el dueño haya movido fotos durante la subida
  const imagenesRef = useRef(imagenes)
  imagenesRef.current = imagenes

  const siguienteId = useRef(1)
  const procesando = useRef(false)
  const montado = useRef(true)

  useEffect(() => {
    montado.current = true
    return () => {
      montado.current = false
      pendRef.current.forEach((p) => URL.revokeObjectURL(p.previa))
    }
  }, [])

  const subiendo = pendientes.some((p) => p.estado !== 'error')
  const fallidas = pendientes.filter((p) => p.estado === 'error').length
  useEffect(() => {
    onEstado?.({ subiendo, fallidas })
  }, [subiendo, fallidas, onEstado])

  /** Sube las fotos en espera de a una (una por request, por el límite de 4,5 MB de Vercel). */
  async function procesarCola() {
    if (procesando.current) return
    procesando.current = true
    try {
      let p: Pendiente | undefined
      while (montado.current && (p = pendRef.current.find((x) => x.estado === 'esperando'))) {
        const { id } = p
        let blob = p.blob
        try {
          if (!blob) {
            actualizar(id, { estado: 'preparando' })
            try {
              blob = await comprimirImagen(p.archivo)
            } catch (err) {
              actualizar(id, { estado: 'error', error: err instanceof Error ? err.message : MENSAJE_FOTO_ILEGIBLE, ilegible: true })
              continue
            }
            actualizar(id, { blob })
          }
          if (!pendRef.current.some((x) => x.id === id)) continue // la quitaron mientras se preparaba

          actualizar(id, { estado: 'subiendo' })
          const ext = blob.type === 'image/webp' ? 'webp' : 'jpg'
          const subida = await apiSubir<{ _id: string; url: string }>('/admin/imagenes', blob, 'imagen', `foto.${ext}`)
          await precargar(miniatura(subida.url, 400))
          if (!montado.current) return

          const quitada = !pendRef.current.some((x) => x.id === id)
          // Sanity reconoce un archivo idéntico y devuelve el mismo asset: no se repite en la lista
          const repetida = imagenesRef.current.some((img) => img._ref === subida._id)
          if (repetida && !quitada) setAviso('Esa foto ya estaba cargada.')
          if (!quitada && !repetida) {
            const nuevas = [...imagenesRef.current, { _ref: subida._id, url: subida.url }]
            imagenesRef.current = nuevas
            onChange(nuevas)
          }
          URL.revokeObjectURL(p.previa)
          setPendientes((ps) => ps.filter((x) => x.id !== id))
        } catch (err) {
          const mensaje = err instanceof ErrorApi ? err.message : 'No se pudo subir la foto. Probá de nuevo.'
          actualizar(id, { estado: 'error', error: mensaje })
        }
      }
    } finally {
      procesando.current = false
    }
  }

  function abrirSelector() {
    if (imagenes.length + pendientes.length >= MAX_FOTOS) {
      setAviso(`Se pueden cargar hasta ${MAX_FOTOS} fotos.`)
      return
    }
    setAviso(null)
    input.current?.click()
  }

  function elegir(e: ChangeEvent<HTMLInputElement>) {
    const archivos = [...(e.target.files ?? [])]
    e.target.value = '' // para poder elegir de nuevo el mismo archivo
    if (!archivos.length) return

    const lugares = MAX_FOTOS - imagenesRef.current.length - pendRef.current.length
    const entran = archivos.slice(0, Math.max(0, lugares))
    setAviso(archivos.length > entran.length ? `Se pueden cargar hasta ${MAX_FOTOS} fotos.` : null)
    if (!entran.length) return

    const nuevas: Pendiente[] = entran.map((archivo) => ({
      id: siguienteId.current++,
      archivo,
      previa: URL.createObjectURL(archivo),
      estado: 'esperando',
    }))
    setPendientes((ps) => [...ps, ...nuevas])
    void procesarCola()
  }

  function reintentar(id: number) {
    actualizar(id, { estado: 'esperando', error: undefined })
    void procesarCola()
  }

  function quitarPendiente(id: number) {
    const p = pendRef.current.find((x) => x.id === id)
    if (p) URL.revokeObjectURL(p.previa)
    setPendientes((ps) => ps.filter((x) => x.id !== id))
  }

  function mover(desde: number, hasta: number) {
    const foto = imagenes[desde]
    if (!foto) return
    const nuevas = imagenes.filter((_, j) => j !== desde)
    nuevas.splice(hasta, 0, foto)
    onChange(nuevas)
  }

  const quitar = (i: number) => onChange(imagenes.filter((_, j) => j !== i))

  const total = imagenes.length + pendientes.length
  const idError = idBoton ? `${idBoton}-error` : undefined

  return (
    <div className="subidor">
      <p className="subidor__ayuda">Así se ven en la tienda: las fotos se recortan en cuadrado. La primera es la portada.</p>

      {total === 0 ? (
        <div className="subidor__vacio">Todavía no hay fotos. Agregá al menos una.</div>
      ) : (
        <ol className="subidor__grilla">
          {imagenes.map((img, i) => {
            const n = i + 1
            return (
              <li key={img._key ?? img._ref} className="subidor__foto">
                <div className="subidor__marco">
                  <img src={miniatura(img.url, 400)} alt={`Foto ${n}`} />
                  {i === 0 && <span className="adm-rotulo adm-rotulo--amarillo subidor__portada">Portada</span>}
                </div>
                <div className="subidor__acciones">
                  <button
                    type="button"
                    className="adm-btn subidor__flecha"
                    aria-label={`Mover foto ${n} antes`}
                    disabled={i === 0}
                    onClick={() => mover(i, i - 1)}
                  >
                    ◀
                  </button>
                  <button
                    type="button"
                    className="adm-btn subidor__flecha"
                    aria-label={`Mover foto ${n} después`}
                    disabled={i === imagenes.length - 1}
                    onClick={() => mover(i, i + 1)}
                  >
                    ▶
                  </button>
                  <button type="button" className="adm-btn subidor__quitar" aria-label={`Quitar foto ${n}`} onClick={() => quitar(i)}>
                    Quitar
                  </button>
                  {i > 0 && (
                    <button type="button" className="adm-btn subidor__hacer-portada" onClick={() => mover(i, 0)}>
                      Hacer portada
                    </button>
                  )}
                </div>
              </li>
            )
          })}

          {pendientes.map((p, j) => {
            const n = imagenes.length + j + 1
            return (
              <li key={`p${p.id}`} className={`subidor__foto subidor__foto--pendiente${p.estado === 'error' ? ' subidor__foto--error' : ''}`}>
                <div className="subidor__marco">
                  <img
                    src={p.previa}
                    alt={`Foto ${n} (sin subir)`}
                    onError={(e) => {
                      e.currentTarget.hidden = true
                    }}
                  />
                  {p.estado !== 'error' && (
                    <span className="subidor__estado" role="status">
                      {TEXTO_ESTADO[p.estado]}
                    </span>
                  )}
                </div>
                {p.estado === 'error' && (
                  <>
                    <p className="subidor__error" role="alert">
                      {p.error}
                    </p>
                    <div className="subidor__acciones">
                      {!p.ilegible && (
                        <button type="button" className="adm-btn adm-btn--amarillo subidor__reintentar" onClick={() => reintentar(p.id)}>
                          Reintentar
                        </button>
                      )}
                      <button type="button" className="adm-btn subidor__quitar" aria-label={`Quitar foto ${n}`} onClick={() => quitarPendiente(p.id)}>
                        Quitar
                      </button>
                    </div>
                  </>
                )}
              </li>
            )
          })}
        </ol>
      )}

      <input ref={input} type="file" accept="image/*" multiple hidden onChange={elegir} />
      <button
        id={idBoton}
        type="button"
        className="adm-btn adm-btn--amarillo subidor__agregar"
        aria-describedby={error ? idError : undefined}
        onClick={abrirSelector}
      >
        Agregar fotos <span className="subidor__contador">({total} de {MAX_FOTOS})</span>
      </button>

      <div aria-live="polite">{aviso && <p className="subidor__aviso">{aviso}</p>}</div>
      {error && (
        <p id={idError} className="adm-error-campo">
          {error}
        </p>
      )}
    </div>
  )
}
