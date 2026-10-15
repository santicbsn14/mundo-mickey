import { useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useProducto } from '../hooks/useProducto.ts'
import Galeria from '../components/producto/Galeria.tsx'
import InfoProducto from '../components/producto/InfoProducto.tsx'
import EntregaProducto from '../components/producto/EntregaProducto.tsx'
import OtrosProductos from '../components/producto/OtrosProductos.tsx'
import './Producto.css'

// El del index.html: se lee al cargar el módulo, antes de que ninguna página lo cambie
const TITULO_ORIGINAL = document.title

export default function Producto() {
  const { slug = '' } = useParams()
  const { estado, producto, reintentar } = useProducto(slug)
  const nombre = producto?.nombre

  useEffect(() => {
    if (!nombre) return
    document.title = `${nombre} · Mundo Mickey`
    return () => {
      document.title = TITULO_ORIGINAL
    }
  }, [nombre])

  return (
    <div className="contenedor producto">
      <Link className="producto__volver" to="/#productos">
        <span aria-hidden="true">←</span> Volver al catálogo
      </Link>

      {estado === 'cargando' && <Esqueleto />}

      {estado === 'error' && (
        <div className="producto__aviso" role="alert">
          <h1 className="producto__aviso-texto">No pudimos cargar este juguete.</h1>
          <button type="button" className="producto__boton" onClick={reintentar}>
            Reintentar
          </button>
        </div>
      )}

      {estado === 'no-encontrado' && (
        <div className="producto__no-encontrado">
          <h1>Este juguete ya no está disponible</h1>
          <p>Puede que se haya agotado o que ya no esté en la tienda. En el catálogo hay otros que te pueden gustar.</p>
          <Link className="producto__boton" to="/#productos">
            Ver el catálogo
          </Link>
        </div>
      )}

      {estado === 'ok' && (
        <>
          <div className="producto__grid">
            <div className="producto__galeria">
              {/* key: al pasar a otro producto, la galería arranca de nuevo en la primera foto */}
              <Galeria key={producto._id} imagenes={producto.imagenes ?? []} nombre={producto.nombre} />
            </div>
            <div className="producto__info">
              <InfoProducto producto={producto} />
            </div>
            <div className="producto__entrega">
              <EntregaProducto />
            </div>
          </div>
          <OtrosProductos actualId={producto._id} />
        </>
      )}
    </div>
  )
}

/** Misma forma que el detalle: el cuadrado de la foto y las líneas de la info. */
function Esqueleto() {
  return (
    <div className="producto__grid producto__esqueleto" aria-busy="true">
      <span className="producto__sr">Cargando juguete…</span>
      <div className="producto__galeria esqueleto__foto" aria-hidden="true" />
      <div className="producto__info esqueleto__info" aria-hidden="true">
        <span className="esqueleto__barra esqueleto__barra--badge" />
        <span className="esqueleto__barra esqueleto__barra--titulo" />
        <span className="esqueleto__barra esqueleto__barra--precio" />
        <span className="esqueleto__barra" />
        <span className="esqueleto__barra esqueleto__barra--corta" />
      </div>
      <div className="producto__entrega esqueleto__barra esqueleto__barra--entrega" aria-hidden="true" />
    </div>
  )
}
