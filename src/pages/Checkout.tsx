import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useCarrito, type ProblemaStock } from '../context/CarritoContext.tsx'
import { useConfiguracion } from '../hooks/useConfiguracion.ts'
import { costoEnvio } from '../lib/formato.ts'
import FormCheckout, { type TipoEntrega } from '../components/checkout/FormCheckout.tsx'
import ResumenCheckout, { type ItemAfectado } from '../components/checkout/ResumenCheckout.tsx'
import './Checkout.css'

// El del index.html: se lee al cargar el módulo, antes de que ninguna página lo cambie
const TITULO_ORIGINAL = document.title

export default function Checkout() {
  const { items, subtotal, abrir, ajustarStock } = useCarrito()
  const { configuracion, cargando } = useConfiguracion()
  const [tipo, setTipo] = useState<TipoEntrega>('retiro')
  const [resumenAbierto, setResumenAbierto] = useState(false)
  const [afectados, setAfectados] = useState<ItemAfectado[]>([])
  const [conflictos, setConflictos] = useState(0)
  const aviso = useRef<HTMLParagraphElement>(null)

  useEffect(() => {
    document.title = 'Finalizar compra · Mundo Mickey'
    return () => {
      document.title = TITULO_ORIGINAL
    }
  }, [])

  const costoLocal = configuracion?.envioLocal?.costo ?? 0
  const costo = tipo === 'envio_local' ? costoLocal : 0
  const textoEnvio = tipo === 'envio_nacional' ? 'A coordinar' : tipo === 'envio_local' ? costoEnvio(costoLocal) : 'Gratis'
  const total = subtotal + costo

  const onTipo = useCallback((t: TipoEntrega) => setTipo(t), [])

  function onConflicto(problemas: ProblemaStock[]) {
    const nombres = new Map(items.map((i) => [i.productoId, i.nombre]))
    setAfectados(problemas.map((p) => ({ ...p, nombre: nombres.get(p.id) ?? 'Un producto' })))
    setResumenAbierto(true)
    setConflictos((n) => n + 1)
    ajustarStock(problemas)
  }

  // Foco en el aviso después de que el carrito se ajustó (si quedó vacío, el aviso está en otra vista)
  useEffect(() => {
    if (conflictos === 0) return
    aviso.current?.focus()
    aviso.current?.scrollIntoView({ block: 'center' })
  }, [conflictos])

  const avisoConflicto = afectados.length > 0 && (
    <p ref={aviso} tabIndex={-1} className="checkout__aviso" role="alert">
      Algunos productos cambiaron mientras comprabas. Ajustamos tu carrito.
    </p>
  )

  if (items.length === 0) {
    return (
      <section className="contenedor checkout checkout--vacio">
        {avisoConflicto}
        <h1 className="checkout__titulo">Tu carrito está vacío</h1>
        <p>Elegí algún juguete y volvé acá para terminar la compra.</p>
        <Link className="checkout__ver" to="/#productos">
          Ver productos
        </Link>
      </section>
    )
  }

  return (
    <div className="contenedor checkout">
      <h1 className="checkout__titulo">Finalizar compra</h1>
      <div className="checkout__grilla">
        <aside className="checkout__resumen">
          {avisoConflicto}
          <ResumenCheckout
            items={items}
            subtotal={subtotal}
            textoEnvio={textoEnvio}
            total={total}
            afectados={afectados}
            abierto={resumenAbierto}
            onAlternar={() => setResumenAbierto((a) => !a)}
            onEditar={abrir}
          />
        </aside>
        <div className="checkout__form">
          <FormCheckout
            items={items}
            configuracion={configuracion}
            cargandoConfiguracion={cargando}
            total={total}
            onTipo={onTipo}
            onConflicto={onConflicto}
          />
        </div>
      </div>
    </div>
  )
}
