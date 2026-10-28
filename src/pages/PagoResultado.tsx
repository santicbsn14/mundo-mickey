import { useEffect, useState, type ReactNode } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { useCarrito } from '../context/CarritoContext.tsx'
import { useConfiguracion } from '../hooks/useConfiguracion.ts'
import { numeroPedido } from '../lib/formato.ts'
import ResultadoPago, { type IconoResultado } from '../components/pago/ResultadoPago.tsx'
import BotonesPago from '../components/pago/BotonesPago.tsx'
import DetalleEntrega from '../components/pago/DetalleEntrega.tsx'
import { useEstadoPedido, type EstadoPublico } from '../components/pago/useEstadoPedido.ts'
import NotFound from './NotFound.tsx'

// Las mismas claves que usa el checkout (FormCheckout)
const CLAVE_DATOS = 'mundo-mickey:checkout'
const CLAVE_ULTIMO_PEDIDO = 'mundo-mickey:ultimo-pedido'

// El del index.html: se lee al cargar el módulo, antes de que ninguna página lo cambie
const TITULO_ORIGINAL = document.title

const RESULTADOS = ['exito', 'error', 'pendiente'] as const
type Resultado = (typeof RESULTADOS)[number]

const COBRADOS = ['pagado', 'enviado', 'entregado']
const ID_PEDIDO = /^[0-9a-f]{24}$/i

/** El último pedido que guardó el checkout, si lo hay. */
function ultimoPedido(): { pedidoId: string; numero?: number } | null {
  try {
    const guardado: unknown = JSON.parse(sessionStorage.getItem(CLAVE_ULTIMO_PEDIDO) ?? 'null')
    if (!guardado || typeof guardado !== 'object') return null
    const { pedidoId, numero } = guardado as { pedidoId?: unknown; numero?: unknown }
    if (typeof pedidoId !== 'string' || !ID_PEDIDO.test(pedidoId)) return null
    return { pedidoId, numero: Number.isInteger(numero) ? (numero as number) : undefined }
  } catch {
    return null
  }
}

function olvidarCheckout() {
  try {
    sessionStorage.removeItem(CLAVE_DATOS)
    sessionStorage.removeItem(CLAVE_ULTIMO_PEDIDO)
  } catch {
    // sin sessionStorage: no había nada guardado
  }
}

/** El pago que agrega Mercado Pago a la vuelta (`payment_id` o `collection_id`), si es un número. */
function pagoDeLaUrl(params: URLSearchParams): string | null {
  for (const clave of ['payment_id', 'collection_id']) {
    const valor = params.get(clave)
    if (valor && /^\d{1,20}$/.test(valor)) return valor
  }
  return null
}

interface Vista {
  titulo: string
  pestana: string
  icono: IconoResultado
  texto?: ReactNode
  botones: 'tienda' | 'reintentar' | 'solo-tienda'
}

export default function PagoResultado() {
  const { resultado } = useParams()
  if (!RESULTADOS.includes(resultado as Resultado)) return <NotFound />
  // `key`: al pasar de una página de resultado a otra, todo arranca de cero
  return <PaginaResultado key={resultado} resultado={resultado as Resultado} />
}

function PaginaResultado({ resultado }: { resultado: Resultado }) {
  const [params] = useSearchParams()
  const { vaciar } = useCarrito()
  const { configuracion } = useConfiguracion()

  // Se leen una sola vez: al confirmarse el pago se borra lo guardado y no tiene que cambiar el pedido
  const [{ pedidoId, numeroGuardado }] = useState(() => {
    const deLaUrl = params.get('pedido')
    if (deLaUrl) return { pedidoId: ID_PEDIDO.test(deLaUrl) ? deLaUrl : null, numeroGuardado: undefined }
    const guardado = ultimoPedido()
    return { pedidoId: guardado?.pedidoId ?? null, numeroGuardado: guardado?.numero }
  })
  const [pago] = useState(() => pagoDeLaUrl(params))

  const consulta = useEstadoPedido(pedidoId, pago, resultado === 'exito')
  const pedido: EstadoPublico | null = consulta.fase === 'consultando' || consulta.fase === 'listo' ? consulta.pedido : null
  const confirmado = !!pedido && COBRADOS.includes(pedido.estado)

  // Pago confirmado: el carrito y los datos del checkout ya no hacen falta
  useEffect(() => {
    if (!confirmado) return
    vaciar()
    olvidarCheckout()
  }, [confirmado, vaciar])

  const numero = pedido?.numero ?? numeroGuardado
  const nro = numero !== undefined ? numeroPedido(numero) : null
  const mensajeWhatsapp = nro ? `Hola! Hice el pedido ${nro}` : 'Hola! Hice un pedido en la tienda'
  const whatsapp = configuracion?.whatsapp?.replace(/\D/g, '') || undefined

  let vista: Vista
  if (consulta.fase === 'no_encontrado') {
    vista = { titulo: 'No encontramos tu pedido.', pestana: 'Pedido no encontrado', icono: 'aviso', botones: 'solo-tienda' }
  } else if (confirmado && pedido) {
    vista = {
      titulo: `¡Listo! Tu pedido ${nro} está confirmado.`,
      pestana: `Pedido ${nro} confirmado`,
      icono: 'listo',
      texto: <DetalleEntrega tipo={pedido.tipoEntrega} configuracion={configuracion} />,
      botones: 'tienda',
    }
  } else if (resultado === 'error' || pedido?.estado === 'cancelado' || pedido?.estado === 'rechazado') {
    vista = {
      titulo: 'No se pudo completar el pago.',
      pestana: 'No se pudo completar el pago',
      icono: 'error',
      texto: <p>Tu carrito y tus datos siguen guardados: podés volver a intentar con otro medio de pago.</p>,
      botones: 'reintentar',
    }
  } else if (resultado === 'pendiente') {
    vista = {
      titulo: 'Tu pago está pendiente de aprobación.',
      pestana: 'Pago pendiente',
      icono: 'aviso',
      texto: <p>Apenas se acredite te avisamos.</p>,
      botones: 'tienda',
    }
  } else if (consulta.fase === 'consultando') {
    vista = { titulo: 'Estamos confirmando tu pago…', pestana: 'Confirmando tu pago', icono: 'esperando', botones: 'tienda' }
  } else {
    // Pasaron los 60 s (o no hubo respuesta) y sigue pendiente
    vista = {
      titulo: 'Tu pago se está procesando.',
      pestana: 'Pago en proceso',
      icono: 'aviso',
      texto: <p>Apenas se acredite te avisamos.</p>,
      botones: 'tienda',
    }
  }

  // En pendiente y error, mientras llega la única consulta, no se muestra nada (para no mostrar un mensaje y cambiarlo)
  const esperandoPrimera = resultado !== 'exito' && consulta.fase === 'consultando' && !pedido

  useEffect(() => {
    document.title = `${esperandoPrimera ? 'Tu pedido' : vista.pestana} · Mundo Mickey`
  }, [vista.pestana, esperandoPrimera])
  useEffect(() => () => void (document.title = TITULO_ORIGINAL), [])

  if (esperandoPrimera) return <section className="contenedor resultado-pago" aria-busy="true" />

  return (
    <ResultadoPago
      icono={vista.icono}
      titulo={vista.titulo}
      acciones={
        vista.botones === 'solo-tienda' ? (
          <BotonesPago mensaje={mensajeWhatsapp} />
        ) : (
          <BotonesPago whatsapp={whatsapp} mensaje={mensajeWhatsapp} reintentar={vista.botones === 'reintentar'} />
        )
      }
    >
      {vista.texto}
    </ResultadoPago>
  )
}
