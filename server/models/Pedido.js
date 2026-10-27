import mongoose from 'mongoose'

export const ESTADOS = ['pendiente_pago', 'pagado', 'enviado', 'entregado', 'rechazado', 'cancelado']
export const TIPOS_ENTREGA = ['retiro', 'envio_local', 'envio_nacional']

const { Schema } = mongoose

const direccionSchema = new Schema(
  {
    calle: { type: String, required: true },
    numero: { type: String, required: true },
    pisoDepto: String,
    localidad: { type: String, required: true },
    provincia: { type: String, required: true },
    codigoPostal: { type: String, required: true },
  },
  { _id: false },
)

// Nombre, precio e imagen al momento de la compra: el pedido no cambia si después se edita o se borra el producto
const itemSchema = new Schema(
  {
    productoId: { type: String, required: true },
    nombre: { type: String, required: true },
    precioUnitario: { type: Number, required: true },
    cantidad: { type: Number, required: true, min: 1 },
    /** URL base del asset en el CDN de Sanity, sin parámetros. */
    imagenUrl: String,
  },
  { _id: false },
)

const pedidoSchema = new Schema(
  {
    numero: { type: Number, required: true, unique: true }, // unique ya crea el índice
    cliente: {
      nombre: { type: String, required: true },
      apellido: { type: String, required: true },
      dni: { type: String, required: true },
      /** Formato wa.me: 549 + código de área sin 0 + número sin 15. */
      celular: { type: String, required: true },
      email: { type: String, required: true },
    },
    entrega: {
      tipo: { type: String, enum: TIPOS_ENTREGA, required: true },
      direccion: { type: direccionSchema, default: undefined },
      notas: String,
    },
    items: { type: [itemSchema], required: true },
    subtotal: { type: Number, required: true },
    costoEnvio: { type: Number, required: true },
    total: { type: Number, required: true },
    estado: { type: String, enum: ESTADOS, default: 'pendiente_pago' },
    historial: [{ _id: false, estado: { type: String, enum: ESTADOS }, fecha: { type: Date, default: Date.now } }],
    seguimiento: { type: new Schema({ empresa: String, codigo: String }, { _id: false }), default: undefined },
    notaInterna: String,
    mp: {
      preferenciaId: String,
      pagoId: String,
      estadoPago: String,
      detalle: String,
    },
    /** Idempotencia del webhook: el stock se descuenta una sola vez. */
    stockDescontado: { type: Boolean, default: false },
  },
  { timestamps: true },
)

pedidoSchema.index({ estado: 1 })
pedidoSchema.index({ createdAt: -1 })

const Pedido = mongoose.models.Pedido ?? mongoose.model('Pedido', pedidoSchema)

export default Pedido
