import { useProductos } from '../../hooks/useProductos.ts'
import { useCarrito } from '../../context/CarritoContext.tsx'
import type { Producto } from '../../types/producto.ts'
import { volarAlCarrito } from '../carrito/volarAlCarrito.ts'
import CardProducto from './CardProducto.tsx'
import './Grilla.css'

const ESQUELETOS = 6

/**
 * El primer destacado va adelante, aunque su `orden` no sea el menor; el resto queda por `orden`
 * (ya viene así de la query). Si por error hay más de un destacado, los otros van como cards normales.
 */
function ordenar(productos: Producto[]): { destacado: Producto | null; resto: Producto[] } {
  const i = productos.findIndex((p) => p.destacado)
  if (i === -1) return { destacado: null, resto: productos }
  return { destacado: productos[i]!, resto: productos.filter((_, j) => j !== i) }
}

/**
 * En mobile (2 columnas) la destacada ocupa una fila entera, así que la última card normal
 * queda sola si las normales son impares. En ese caso ocupa las 2 columnas.
 */
function anchaEnMobile(indice: number, totalNormales: number): string | undefined {
  return totalNormales % 2 === 1 && indice === totalNormales - 1 ? 'card--ancha-mobile' : undefined
}

export default function Grilla() {
  const { estado, productos, reintentar } = useProductos()

  return (
    <section className="productos contenedor" id="productos" aria-labelledby="productos-titulo">
      <div className="productos__cabecera">
        <h2 className="productos__titulo" id="productos-titulo">Lo más buscado</h2>
        <p className="productos__bajada">Pocas unidades de cada uno. Cuando se terminan, se terminan.</p>
      </div>

      {estado === 'cargando' && <Esqueletos />}

      {estado === 'error' && (
        <div className="productos__aviso" role="alert">
          <p>No pudimos cargar los productos.</p>
          <button type="button" className="productos__reintentar" onClick={reintentar}>
            Reintentar
          </button>
        </div>
      )}

      {estado === 'ok' && productos.length === 0 && (
        <div className="productos__aviso">
          <p>Pronto vas a encontrar juguetes acá.</p>
        </div>
      )}

      {estado === 'ok' && productos.length > 0 && <Lista productos={productos} />}
    </section>
  )
}

function Lista({ productos }: { productos: Producto[] }) {
  const { agregar, cantidadDe } = useCarrito()
  const { destacado, resto } = ordenar(productos)

  const alAgregar = (producto: Producto, origen: HTMLElement) => {
    agregar(producto)
    volarAlCarrito(origen)
  }

  return (
    <div className="grilla">
      {destacado && (
        <CardProducto producto={destacado} destacada onAgregar={alAgregar} enCarrito={cantidadDe(destacado._id)} />
      )}
      {resto.map((p, i) => (
        <CardProducto
          key={p._id}
          producto={p}
          className={anchaEnMobile(i, resto.length)}
          onAgregar={alAgregar}
          enCarrito={cantidadDe(p._id)}
        />
      ))}
    </div>
  )
}

/** Misma grilla que la real, con la primera card grande. */
function Esqueletos() {
  const normales = ESQUELETOS - 1
  return (
    <div className="grilla" aria-busy="true">
      <span className="productos__sr">Cargando productos…</span>
      {Array.from({ length: ESQUELETOS }, (_, i) => {
        const clases = ['card', 'card--esqueleto']
        if (i === 0) clases.push('card--destacada')
        else {
          const ancha = anchaEnMobile(i - 1, normales)
          if (ancha) clases.push(ancha)
        }
        return (
          <div key={i} className={clases.join(' ')} aria-hidden="true">
            <div className="card__foto" />
            <div className="card__cuerpo">
              <span className="esqueleto__linea" />
              <span className="esqueleto__linea esqueleto__linea--corta" />
              <span className="esqueleto__linea esqueleto__linea--precio" />
            </div>
          </div>
        )
      })}
    </div>
  )
}
