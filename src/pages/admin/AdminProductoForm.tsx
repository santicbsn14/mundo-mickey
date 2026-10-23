import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { apiGet, ErrorApi } from '../../lib/api.ts'
import type { ProductoAdmin } from '../../lib/productosAdmin.ts'
import FormProducto from '../../components/admin/FormProducto.tsx'

type Carga =
  | { estado: 'cargando' }
  | { estado: 'listo'; producto: ProductoAdmin }
  | { estado: 'no-encontrado' }
  | { estado: 'error'; mensaje: string }

/** `/admin/productos/nuevo` (vacío) y `/admin/productos/:id` (cargado desde la API). */
export default function AdminProductoForm() {
  const { id } = useParams()
  return (
    <div className="contenedor">
      {/* key: al pasar de un producto a otro (o a "nuevo") el formulario arranca de cero */}
      {id ? <Editar key={id} id={id} /> : <FormProducto key="nuevo" />}
    </div>
  )
}

function Editar({ id }: { id: string }) {
  const [carga, setCarga] = useState<Carga>({ estado: 'cargando' })
  const [intento, setIntento] = useState(0)

  useEffect(() => {
    let vigente = true
    setCarga({ estado: 'cargando' })
    apiGet<ProductoAdmin>(`/admin/productos/${encodeURIComponent(id)}`)
      .then((producto) => vigente && setCarga({ estado: 'listo', producto }))
      .catch((err) => {
        if (!vigente) return
        if (err instanceof ErrorApi && err.status === 404) setCarga({ estado: 'no-encontrado' })
        else setCarga({ estado: 'error', mensaje: err instanceof ErrorApi ? err.message : 'Algo salió mal.' })
      })
    return () => {
      vigente = false
    }
  }, [id, intento])

  if (carga.estado === 'listo') return <FormProducto producto={carga.producto} />

  return (
    <section className="admin-vacia">
      {carga.estado === 'cargando' && (
        <p className="adm-estado" role="status">
          Cargando producto…
        </p>
      )}
      {carga.estado === 'no-encontrado' && (
        <>
          <h1>Este producto no existe</h1>
          <p>Puede que lo hayan eliminado.</p>
          <p>
            <Link to="/admin/productos">Volver a Productos</Link>
          </p>
        </>
      )}
      {carga.estado === 'error' && (
        <>
          <h1>No se pudo cargar el producto</h1>
          <div className="adm-estado-error">
            <div className="adm-alerta" role="alert">
              {carga.mensaje}
            </div>
            <button type="button" className="adm-btn" onClick={() => setIntento((n) => n + 1)}>
              Reintentar
            </button>
            <Link to="/admin/productos">Volver a Productos</Link>
          </div>
        </>
      )}
    </section>
  )
}
