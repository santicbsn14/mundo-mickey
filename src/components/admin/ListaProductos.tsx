import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { apiGet, apiPatch, apiPut, ErrorApi } from '../../lib/api.ts'
import { pesos } from '../../lib/formato.ts'
import { AVISO_CDN, cuerpoDesde, miniatura, type EstadoListado, type ProductoAdmin } from '../../lib/productosAdmin.ts'
import './ListaProductos.css'

const mensaje = (err: unknown) => (err instanceof ErrorApi ? err.message : 'Algo salió mal. Probá de nuevo.')

export default function ListaProductos() {
  const location = useLocation()
  const navigate = useNavigate()

  const [productos, setProductos] = useState<ProductoAdmin[] | null>(null)
  const [errorCarga, setErrorCarga] = useState<string | null>(null)
  // Una acción rápida a la vez: así un PUT y un reordenamiento no se pisan
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [errorFila, setErrorFila] = useState<{ id: string; texto: string } | null>(null)

  // El aviso viene del formulario (por el state de la navegación) o de la primera acción rápida
  const [aviso, setAviso] = useState<string | null>((location.state as EstadoListado | null)?.aviso ?? null)
  const yaAvisado = useRef(aviso !== null)

  useEffect(() => {
    // Saca el aviso del historial: al recargar o volver atrás no aparece de nuevo
    if ((location.state as EstadoListado | null)?.aviso) navigate('.', { replace: true, state: null })
  }, [location.state, navigate])

  const cargar = useCallback(async () => {
    setErrorCarga(null)
    setProductos(null)
    try {
      setProductos(await apiGet<ProductoAdmin[]>('/admin/productos'))
    } catch (err) {
      setErrorCarga(mensaje(err))
    }
  }, [])

  useEffect(() => {
    void cargar()
  }, [cargar])

  function avisarCdn() {
    if (yaAvisado.current) return
    yaAvisado.current = true
    setAviso(`Listo. ${AVISO_CDN}`)
  }

  async function alternarVisible(p: ProductoAdmin) {
    if (!productos) return
    const anteriores = productos
    setOcupado(p._id)
    setErrorFila(null)
    setProductos(productos.map((x) => (x._id === p._id ? { ...x, activo: !p.activo } : x)))
    try {
      const guardado = await apiPut<ProductoAdmin>(`/admin/productos/${p._id}`, cuerpoDesde(p, { activo: !p.activo }))
      setProductos((ps) => ps && ps.map((x) => (x._id === p._id ? guardado : x)))
      avisarCdn()
    } catch (err) {
      setProductos(anteriores)
      setErrorFila({ id: p._id, texto: `No se pudo ${p.activo ? 'ocultar' : 'mostrar'}: ${mensaje(err)}` })
    } finally {
      setOcupado(null)
    }
  }

  async function mover(i: number, delta: -1 | 1) {
    if (!productos) return
    const p = productos[i]
    if (!p) return
    const anteriores = productos
    const nuevos = productos.filter((x) => x !== p)
    nuevos.splice(i + delta, 0, p)
    setOcupado(p._id)
    setErrorFila(null)
    setProductos(nuevos)
    try {
      // La respuesta ya trae la lista ordenada
      setProductos(await apiPatch<ProductoAdmin[]>('/admin/productos/orden', { ids: nuevos.map((x) => x._id) }))
      avisarCdn()
    } catch (err) {
      setProductos(anteriores)
      setErrorFila({ id: p._id, texto: `No se pudo cambiar el orden: ${mensaje(err)}` })
    } finally {
      setOcupado(null)
    }
  }

  return (
    <section className="lp">
      <div className="lp__cabecera">
        <h1 className="adm-titulo">Productos</h1>
        <Link to="/admin/productos/nuevo" className="adm-btn adm-btn--primario">
          Nuevo producto
        </Link>
      </div>

      <div aria-live="polite">
        {aviso && (
          <div className="adm-aviso lp__aviso">
            <p>{aviso}</p>
            <button type="button" aria-label="Cerrar aviso" onClick={() => setAviso(null)}>
              ✕
            </button>
          </div>
        )}
      </div>

      {errorCarga ? (
        <div className="adm-estado-error">
          <div className="adm-alerta" role="alert">
            No se pudieron cargar los productos. {errorCarga}
          </div>
          <button type="button" className="adm-btn" onClick={() => void cargar()}>
            Reintentar
          </button>
        </div>
      ) : !productos ? (
        <p className="adm-estado" role="status">
          Cargando productos…
        </p>
      ) : productos.length === 0 ? (
        <div className="lp__vacio">
          <p>Todavía no hay productos.</p>
          <Link to="/admin/productos/nuevo" className="adm-btn adm-btn--amarillo">
            Crear el primero
          </Link>
        </div>
      ) : (
        <>
          <ul className="lp__lista">
            {productos.map((p, i) => {
              const portada = p.imagenes?.[0]
              const ruta = `/admin/productos/${p._id}`
              return (
                <li key={p._id} className={`lp__fila${p.activo ? '' : ' lp__fila--oculto'}`}>
                  <div className="lp__foto">
                    {portada ? <img src={miniatura(portada.url, 160)} alt="" loading="lazy" /> : <span aria-hidden="true">Sin foto</span>}
                  </div>

                  <div className="lp__info">
                    {/* El link se estira sobre toda la fila: tocarla abre el formulario */}
                    <Link to={ruta} className="lp__nombre">
                      {p.nombre}
                    </Link>
                    <p className="lp__datos">
                      <span className="lp__precio">{pesos(p.precio)}</span>
                      <span className={p.stock === 0 ? 'lp__sin-stock' : undefined}>
                        {p.stock === 0 ? 'Sin stock' : `Stock: ${p.stock}`}
                      </span>
                    </p>
                    {(!p.activo || p.destacado) && (
                      <p className="lp__rotulos">
                        {p.destacado && <span className="adm-rotulo adm-rotulo--amarillo">★ Destacado</span>}
                        {!p.activo && <span className="adm-rotulo adm-rotulo--hueco">Oculto</span>}
                      </p>
                    )}
                  </div>

                  <div className="lp__acciones">
                    <button
                      type="button"
                      className="adm-btn"
                      aria-label={`${p.activo ? 'Ocultar' : 'Mostrar'} «${p.nombre}»`}
                      disabled={ocupado !== null}
                      onClick={() => void alternarVisible(p)}
                    >
                      {p.activo ? 'Ocultar' : 'Mostrar'}
                    </button>
                    <button
                      type="button"
                      className="adm-btn"
                      aria-label={`Subir «${p.nombre}»`}
                      disabled={i === 0 || ocupado !== null}
                      onClick={() => void mover(i, -1)}
                    >
                      Subir
                    </button>
                    <button
                      type="button"
                      className="adm-btn"
                      aria-label={`Bajar «${p.nombre}»`}
                      disabled={i === productos.length - 1 || ocupado !== null}
                      onClick={() => void mover(i, 1)}
                    >
                      Bajar
                    </button>
                    <Link to={ruta} className="adm-btn" aria-label={`Editar «${p.nombre}»`}>
                      Editar
                    </Link>
                  </div>

                  {errorFila?.id === p._id && (
                    <p className="lp__error" role="alert">
                      {errorFila.texto}
                    </p>
                  )}
                </li>
              )
            })}
          </ul>
          <p className="lp__nota">El orden de esta lista es el orden de la tienda (el destacado siempre va primero).</p>
        </>
      )}
    </section>
  )
}
