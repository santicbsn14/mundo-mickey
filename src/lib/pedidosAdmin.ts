// Pedidos tal como los devuelve la API del panel (server/controllers/adminPedidos.js), y los textos que
// comparten el listado y el detalle.
import { numeroPedido } from './formato.ts'

export type EstadoPedido = 'pendiente_pago' | 'pagado' | 'enviado' | 'entregado' | 'rechazado' | 'cancelado'
export type TipoEntrega = 'retiro' | 'envio_local' | 'envio_nacional'

/** Una tarjeta del listado. */
export interface PedidoResumen {
  _id: string
  numero: number
  fecha: string
  nombre: string
  apellido: string
  total: number
  tipoEntrega: TipoEntrega
  estado: EstadoPedido
  cantidad: number
  /** `notaInterna` tiene un "Revisar" o una "Sobreventa". */
  revisar: boolean
}

export interface ListadoPedidos {
  pedidos: PedidoResumen[]
  total: number
  pagina: number
  paginas: number
  /** Por estado, con la búsqueda pero sin el filtro de estado. */
  conteos: Record<EstadoPedido, number>
}

export interface Direccion {
  calle: string
  numero: string
  pisoDepto?: string
  localidad: string
  provincia: string
  codigoPostal: string
}

export interface Seguimiento {
  empresa: string
  codigo: string
}

export interface Pedido {
  _id: string
  numero: number
  cliente: { nombre: string; apellido: string; dni: string; celular: string; email: string }
  entrega: { tipo: TipoEntrega; direccion?: Direccion; notas?: string }
  items: { productoId: string; nombre: string; precioUnitario: number; cantidad: number; imagenUrl?: string }[]
  subtotal: number
  costoEnvio: number
  total: number
  estado: EstadoPedido
  historial: { estado: EstadoPedido; fecha: string }[]
  seguimiento?: Seguimiento
  notaInterna?: string
  mp?: { preferenciaId?: string; pagoId?: string; estadoPago?: string; detalle?: string }
  stockDescontado: boolean
  stockRepuesto: boolean
  createdAt: string
  updatedAt: string
}

/** Lo que recibe `PATCH /api/admin/pedidos/:id`. */
export interface CambiosPedido {
  estado?: EstadoPedido
  seguimiento?: Seguimiento | null
  notaInterna?: string
  reponerStock?: boolean
}

/** Las mismas que valida la API. */
export const EMPRESAS = ['Correo Argentino', 'Andreani', 'OCA', 'Vía Cargo', 'Otra']

export const NOMBRE_ESTADO: Record<EstadoPedido, string> = {
  pagado: 'A preparar',
  enviado: 'Enviado',
  entregado: 'Entregado',
  pendiente_pago: 'Pendiente de pago',
  cancelado: 'Cancelado',
  rechazado: 'Rechazado',
}

/** Cambios de estado que acepta la API (sin `cancelado`, que tiene su propio botón). */
export const CORRECCIONES: Partial<Record<EstadoPedido, EstadoPedido[]>> = {
  pagado: ['enviado', 'entregado'],
  enviado: ['pagado', 'entregado'],
  entregado: ['pagado', 'enviado'],
}

export const ENTREGA_CORTA: Record<TipoEntrega, string> = {
  retiro: 'Retiro',
  envio_local: 'Envío San Nicolás',
  envio_nacional: 'Envío al país',
}

export const ENTREGA_LARGA: Record<TipoEntrega, string> = {
  retiro: 'Retiro en el local',
  envio_local: 'Envío en San Nicolás',
  envio_nacional: 'Envío al resto del país',
}

/** `mp.estadoPago` de Mercado Pago, en castellano. */
const ESTADOS_PAGO: Record<string, string> = {
  approved: 'Aprobado',
  authorized: 'Autorizado',
  pending: 'Pendiente',
  in_process: 'En proceso',
  in_mediation: 'En mediación',
  rejected: 'Rechazado',
  cancelled: 'Cancelado',
  refunded: 'Devuelto',
  charged_back: 'Contracargo',
}
export const estadoPago = (s?: string) => (s ? (ESTADOS_PAGO[s] ?? s) : 'Sin pago todavía')

/** Un pendiente de pago con más de 24 h: el link de Mercado Pago ya venció. */
export const linkVencido = (estado: EstadoPedido, fecha: string) =>
  estado === 'pendiente_pago' && Date.now() - Date.parse(fecha) > 24 * 60 * 60 * 1000

/** Las líneas de la nota interna con un "Revisar" o una "Sobreventa" (las escribe el sistema). */
export const lineasRevisar = (nota?: string) => (nota ?? '').split('\n').filter((l) => /revisar|sobreventa/i.test(l))

const dosDigitos = (n: number) => String(n).padStart(2, '0')
const hora = (d: Date) => `${dosDigitos(d.getHours())}:${dosDigitos(d.getMinutes())}`
const mismoDia = (a: Date, b: Date) => a.toDateString() === b.toDateString()

/** "hoy 14:32", "ayer 09:10", "23/10 18:05" (o "23/10/2025 18:05" si es de otro año). */
export function fechaCorta(iso: string) {
  const d = new Date(iso)
  const hoy = new Date()
  const ayer = new Date(hoy)
  ayer.setDate(hoy.getDate() - 1)
  if (mismoDia(d, hoy)) return `hoy ${hora(d)}`
  if (mismoDia(d, ayer)) return `ayer ${hora(d)}`
  const anio = d.getFullYear() === hoy.getFullYear() ? '' : `/${d.getFullYear()}`
  return `${dosDigitos(d.getDate())}/${dosDigitos(d.getMonth() + 1)}${anio} ${hora(d)}`
}

/** "23/10/2026 18:05" */
export function fechaCompleta(iso: string) {
  const d = new Date(iso)
  return `${dosDigitos(d.getDate())}/${dosDigitos(d.getMonth() + 1)}/${d.getFullYear()} ${hora(d)}`
}

// Códigos de área de 2 y 3 dígitos; los demás son de 4
const AREAS_3 = new Set('220 221 223 230 236 237 249 260 261 263 264 266 280 291 294 297 298 299 336 341 342 343 345 348 351 353 358 362 364 370 376 379 380 381 383 385 387 388'.split(' '))

/** `5493364123456` → `+54 9 336 412-3456`. Si no tiene la forma esperada, lo devuelve como está. */
export function celularLegible(celular: string) {
  const m = celular.match(/^549(\d{10})$/)
  if (!m) return celular
  const d = m[1] ?? ''
  const area = d.startsWith('11') ? 2 : AREAS_3.has(d.slice(0, 3)) ? 3 : 4
  const resto = d.slice(area)
  return `+54 9 ${d.slice(0, area)} ${resto.slice(0, -4)}-${resto.slice(-4)}`
}

/** "Av. Savio 123, 2° B" */
export const lineaCalle = (d: Direccion) => `${d.calle} ${d.numero}${d.pisoDepto ? `, ${d.pisoDepto}` : ''}`

/** El texto para la etiqueta del envío ("Copiar dirección"). */
export function textoEtiqueta(p: Pedido) {
  const d = p.entrega.direccion
  if (!d) return ''
  return [
    `${p.cliente.nombre} ${p.cliente.apellido}`,
    lineaCalle(d),
    `${d.codigoPostal} ${d.localidad}, ${d.provincia}`,
    `DNI ${p.cliente.dni} · Cel ${celularLegible(p.cliente.celular)}`,
  ].join('\n')
}

export type Plantilla = 'retiro' | 'coordinar' | 'enviado' | 'libre'

export const NOMBRE_PLANTILLA: Record<Plantilla, string> = {
  retiro: 'Pedido listo para retirar',
  coordinar: 'Coordinar envío',
  enviado: 'Pedido enviado',
  libre: 'Mensaje libre',
}

/** La plantilla que conviene según el estado y la entrega. */
export function plantillaSugerida(p: Pedido): Plantilla {
  if (p.estado === 'pagado') {
    if (p.entrega.tipo === 'retiro') return 'retiro'
    return p.seguimiento?.codigo ? 'enviado' : 'coordinar'
  }
  if (p.estado === 'enviado') return 'enviado'
  return 'libre'
}

/** Datos del local para las plantillas (de la configuración). */
export interface DatosLocal {
  direccion?: string
  horarios?: string
}

/** El texto de cada plantilla de WhatsApp. */
export function mensajePlantilla(plantilla: Plantilla, p: Pedido, local: DatosLocal) {
  const nombre = p.cliente.nombre
  const n = numeroPedido(p.numero)
  const saludo = `Hola ${nombre}! Te escribimos de Mundo Mickey por tu pedido ${n}.`
  switch (plantilla) {
    case 'retiro': {
      const donde = local.direccion?.trim() ? `en ${local.direccion.trim()}` : 'en el local'
      const horarios = local.horarios?.trim() ? ` Horarios: ${local.horarios.trim().replace(/\s*\n\s*/g, ' / ')}.` : ''
      return `${saludo} Ya está listo para retirar ${donde}.${horarios}`
    }
    case 'coordinar': {
      const localidad = p.entrega.direccion?.localidad
      return `${saludo} Queremos coordinar el envío${localidad ? ` a ${localidad}` : ''}.`
    }
    case 'enviado': {
      const { empresa, codigo } = p.seguimiento ?? { empresa: '', codigo: '' }
      const por = empresa && empresa !== 'Otra' ? ` por ${empresa}` : ''
      const seguimiento = codigo ? ` Código de seguimiento: ${codigo}.` : ''
      return `Hola ${nombre}! Tu pedido ${n} de Mundo Mickey ya salió${por}.${seguimiento}`
    }
    default:
      return saludo
  }
}

export const linkWhatsapp = (celular: string, texto: string) => `https://wa.me/${celular}?text=${encodeURIComponent(texto)}`

/** Un `ErrorApi` de cancelar con el stock sin devolver trae el pedido ya cancelado. */
export const pedidoDelError = (datos: unknown): Pedido | null =>
  datos && typeof datos === 'object' && 'pedido' in datos ? ((datos as { pedido: Pedido }).pedido ?? null) : null
