import mongoose from 'mongoose'

// Un documento por secuencia: { _id: 'pedido', seq: 12 }
const counterSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    seq: { type: Number, default: 0 },
  },
  { versionKey: false },
)

// En local, `--watch` vuelve a importar los modelos: se reutiliza el ya registrado
const Counter = mongoose.models.Counter ?? mongoose.model('Counter', counterSchema)

/**
 * El próximo número de la secuencia (1, 2, 3…). Es atómico: dos pedidos a la vez nunca reciben el mismo.
 * Si el pedido falla después, ese número queda salteado.
 */
export async function siguienteNumero(nombre) {
  const doc = await Counter.findOneAndUpdate({ _id: nombre }, { $inc: { seq: 1 } }, { upsert: true, returnDocument: 'after' })
  return doc.seq
}

export default Counter
