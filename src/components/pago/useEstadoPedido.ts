import { useEffect, useState } from 'react'
import { apiGet, ErrorApi } from '../../lib/api.ts'

export type EstadoPedido = 'pendiente_pago' | 'pagado' | 'enviado' | 'entregado' | 'rechazado' | 'cancelado'
export type TipoEntrega = 'retiro' | 'envio_local' | 'envio_nacional'

/** Lo que devuelve `GET /api/pedidos/:id/estado`. */
export interface EstadoPublico {
  numero: number
  estado: EstadoPedido
  tipoEntrega: TipoEntrega
}

export type Consulta =
  | { fase: 'consultando'; pedido: EstadoPublico | null }
  /** Terminó: el pedido ya no está pendiente, o se agotaron las consultas. */
  | { fase: 'listo'; pedido: EstadoPublico }
  | { fase: 'no_encontrado' }
  /** No se pudo consultar (sin conexión o error de la API). */
  | { fase: 'sin_respuesta' }

/** Cada cuánto y hasta cuándo consulta la página de éxito mientras el pago no se confirma. */
const INTERVALO_MS = 3000
const LIMITE_MS = 60000

/**
 * Consulta el estado del pedido. Con `repetir`, vuelve a consultar cada 3 s mientras siga
 * `pendiente_pago`, hasta 60 s. `pago` (el `payment_id` de la vuelta de Mercado Pago) se manda como
 * `?pago=`: si el webhook todavía no llegó, la API lo confirma con ese pago.
 */
export function useEstadoPedido(pedidoId: string | null, pago: string | null, repetir: boolean): Consulta {
  const [consulta, setConsulta] = useState<Consulta>(() =>
    pedidoId ? { fase: 'consultando', pedido: null } : { fase: 'no_encontrado' },
  )

  useEffect(() => {
    if (!pedidoId) return
    let vigente = true
    let timer: ReturnType<typeof setTimeout> | undefined
    const inicio = Date.now()
    const ruta = `/pedidos/${encodeURIComponent(pedidoId)}/estado${pago ? `?pago=${encodeURIComponent(pago)}` : ''}`

    async function consultar() {
      let pedido: EstadoPublico | null = null
      try {
        pedido = await apiGet<EstadoPublico>(ruta)
      } catch (err) {
        if (!vigente) return
        if (err instanceof ErrorApi && err.status === 404) return setConsulta({ fase: 'no_encontrado' })
        // Sin conexión o un error pasajero: si se puede, se sigue intentando
        if (!repetir || Date.now() - inicio + INTERVALO_MS > LIMITE_MS) {
          setConsulta((c) => (c.fase === 'consultando' && c.pedido ? { fase: 'listo', pedido: c.pedido } : { fase: 'sin_respuesta' }))
          return
        }
        timer = setTimeout(consultar, INTERVALO_MS)
        return
      }
      if (!vigente) return
      const sigue = repetir && pedido.estado === 'pendiente_pago' && Date.now() - inicio + INTERVALO_MS <= LIMITE_MS
      setConsulta(sigue ? { fase: 'consultando', pedido } : { fase: 'listo', pedido })
      if (sigue) timer = setTimeout(consultar, INTERVALO_MS)
    }

    consultar()
    return () => {
      vigente = false
      clearTimeout(timer)
    }
  }, [pedidoId, pago, repetir])

  return consulta
}
