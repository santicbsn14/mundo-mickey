import mongoose from 'mongoose'
import { requerirEnv } from './env.js'

// Cache en globalThis: en Vercel la instancia de la función se reutiliza entre
// invocaciones, y en local sobrevive a los reimports. Así no se abre una
// conexión nueva por request.
const cache = (globalThis.__mongoose ??= { conn: null, promise: null })

export async function conectarDB() {
  if (cache.conn) return cache.conn

  if (!cache.promise) {
    const uri = requerirEnv('MONGODB_URI')
    cache.promise = mongoose
      .connect(uri, { bufferCommands: false, serverSelectionTimeoutMS: 8000 })
      .then((m) => {
        console.log(`MongoDB conectada (base: ${m.connection.name})`)
        return m
      })
  }

  try {
    cache.conn = await cache.promise
  } catch (err) {
    // Si falló, limpiamos la promesa para reintentar en el próximo request
    cache.promise = null
    throw err
  }
  return cache.conn
}

export function estadoDB() {
  return mongoose.connection.readyState === 1 ? 'conectada' : 'desconectada'
}
