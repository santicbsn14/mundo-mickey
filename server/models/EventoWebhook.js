import mongoose from 'mongoose'

export const RESULTADOS = ['procesado', 'ignorado', 'firma_invalida', 'error']

/** 30 días: alcanza para revisar un problema y la colección no crece sin límite. */
const VIDA_SEGUNDOS = 30 * 24 * 60 * 60

// Cada notificación de Mercado Pago y qué se hizo con ella. Sirve para debug: en Vercel Hobby los logs duran 1 hora.
// No se guardan los headers completos (solo x-request-id) ni nada del token.
const eventoWebhookSchema = new mongoose.Schema(
  {
    // `expires` crea el índice TTL: Mongo borra el evento 30 días después de recibido
    recibidoEn: { type: Date, default: Date.now, expires: VIDA_SEGUNDOS },
    /** El query string tal como llegó (`data.id=…&type=payment`). Texto: las claves con punto no van bien en Mongo. */
    query: String,
    /** El cuerpo en JSON, recortado a 4 KB. */
    body: String,
    /** Header `x-request-id`. */
    requestId: String,
    firmaValida: Boolean,
    /** Header `x-signature` (`ts=…,v1=…`), solo si la firma no coincidió: es un HMAC, no la clave, y sirve para ver con qué clave se firmó. */
    firma: String,
    /** `type` o `topic` de la notificación (`payment`, `merchant_order`…). */
    tipo: String,
    pagoId: String,
    pedidoId: String,
    resultado: { type: String, enum: RESULTADOS, required: true },
    detalle: String,
    duracionMs: Number,
  },
  { versionKey: false },
)

const EventoWebhook = mongoose.models.EventoWebhook ?? mongoose.model('EventoWebhook', eventoWebhookSchema)

export default EventoWebhook
