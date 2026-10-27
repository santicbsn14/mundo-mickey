import type { ItemCarrito } from '../../context/CarritoContext.tsx'
import { pesos } from '../../lib/formato.ts'
import { urlImagen } from '../../lib/sanity.ts'
import './ResumenCheckout.css'

/** Un ítem que cambió según el 409 del checkout, con el nombre que tenía en el carrito. */
export interface ItemAfectado {
  id: string
  nombre: string
  motivo: 'no_disponible' | 'sin_stock'
  stockDisponible: number
}

interface Props {
  items: ItemCarrito[]
  subtotal: number
  /** "Gratis", el costo o "A coordinar". */
  textoEnvio: string
  total: number
  afectados: ItemAfectado[]
  /** Solo en el celular: en desktop el resumen está siempre abierto. */
  abierto: boolean
  onAlternar: () => void
  onEditar: () => void
}

const ID_CONTENIDO = 'resumen-checkout'

export default function ResumenCheckout({ items, subtotal, textoEnvio, total, afectados, abierto, onAlternar, onEditar }: Props) {
  const cantidad = items.reduce((suma, i) => suma + i.cantidad, 0)
  const porId = new Map(afectados.map((a) => [a.id, a]))
  // Los que el 409 sacó del carrito: se siguen mostrando para que se entienda qué pasó
  const quitados = afectados.filter((a) => !items.some((i) => i.productoId === a.id))

  return (
    <section className={`resumen${abierto ? ' resumen--abierto' : ''}`} aria-labelledby="resumen-titulo">
      <h2 className="resumen__titulo" id="resumen-titulo">
        Tu pedido
      </h2>

      {/* Celular: cerrado por defecto, con la cantidad y el total a la vista */}
      <button type="button" className="resumen__alternar" aria-expanded={abierto} aria-controls={ID_CONTENIDO} onClick={onAlternar}>
        <span>
          {cantidad} {cantidad === 1 ? 'producto' : 'productos'} · <strong>{pesos(total)}</strong>
        </span>
        <span className="resumen__alternar-accion">
          {abierto ? 'Ocultar' : 'Ver detalle'} <span aria-hidden="true">{abierto ? '▲' : '▼'}</span>
        </span>
      </button>

      <div className="resumen__contenido" id={ID_CONTENIDO}>
        <ul className="resumen__lista">
          {items.map((item) => {
            const afectado = porId.get(item.productoId)
            return (
              <li key={item.productoId} className="resumen__item">
                <div className="resumen__mini">
                  {item.imagen && <img src={urlImagen(item.imagen, 112)} alt="" width={56} height={56} decoding="async" />}
                </div>
                <div className="resumen__datos">
                  <span className="resumen__nombre">{item.nombre}</span>
                  <span className="resumen__cantidad">
                    {item.cantidad} × {pesos(item.precio)}
                  </span>
                  {afectado?.motivo === 'sin_stock' && <span className="resumen__marca">Quedan {afectado.stockDisponible}</span>}
                </div>
                <span className="resumen__precio">{pesos(item.cantidad * item.precio)}</span>
              </li>
            )
          })}
          {quitados.map((a) => (
            <li key={a.id} className="resumen__item resumen__item--quitado">
              <div className="resumen__mini" />
              <div className="resumen__datos">
                <span className="resumen__nombre">{a.nombre}</span>
                <span className="resumen__marca">Sin stock</span>
              </div>
            </li>
          ))}
        </ul>

        <button type="button" className="resumen__editar" onClick={onEditar}>
          Editar carrito
        </button>

        <dl className="resumen__montos">
          <div>
            <dt>Subtotal</dt>
            <dd>{pesos(subtotal)}</dd>
          </div>
          <div>
            <dt>Envío</dt>
            <dd>{textoEnvio}</dd>
          </div>
          <div className="resumen__total">
            <dt>Total</dt>
            <dd>{pesos(total)}</dd>
          </div>
        </dl>
      </div>
    </section>
  )
}
