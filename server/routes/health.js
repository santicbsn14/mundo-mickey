import { Router } from 'express'
import { conectarDB, estadoDB } from '../config/db.js'
import { diagnosticoMp } from '../lib/mercadopago.js'
import { sanityLectura } from '../lib/sanity.js'

const router = Router()

async function chequearSanity() {
  try {
    await sanityLectura().fetch('count(*[_type == "producto"])')
    return { sanity: 'ok' }
  } catch (err) {
    console.error('Health: no se pudo consultar Sanity:', err.message)
    return { sanity: 'error', error: err.message }
  }
}

router.get('/health', async (req, res) => {
  // Sanity y Mercado Pago se consultan en paralelo con la conexión a Mongo
  const sanity = chequearSanity()
  const mercadoPago = diagnosticoMp()
  // `invalido`: tiene caracteres que no puede tener una clave real (por ejemplo los "•" de la clave tapada del panel)
  const secreto = process.env.MP_WEBHOOK_SECRET?.trim()
  const mpWebhook = !secreto ? 'sin_configurar' : /^[\x21-\x7e]+$/.test(secreto) ? 'configurado' : 'invalido'

  const extras = async () => {
    const [s, mp] = await Promise.all([sanity, mercadoPago])
    const errores = { ...(s.error && { sanity: s.error }), ...(mp.error && { mp: mp.error }) }
    return {
      sanity: s.sanity,
      mp: mp.mp,
      mpWebhook,
      ...(Object.keys(errores).length && { errores }),
      _sanityOk: s.sanity === 'ok',
    }
  }

  try {
    await conectarDB()
  } catch (err) {
    console.error('Health: no se pudo conectar a MongoDB:', err.message)
    const { _sanityOk, ...e } = await extras()
    return res.status(500).json({ ok: false, db: 'desconectada', error: err.message, ...e })
  }

  // Mongo bien: si falla Sanity igual responde 200, con ok: false y el motivo.
  // Mercado Pago no cambia `ok` ni el código: se informa aparte en `mp`
  const { _sanityOk, ...e } = await extras()
  res.json({
    ok: _sanityOk,
    db: estadoDB(),
    ...e,
    entorno: process.env.VERCEL_ENV ?? 'local',
  })
})

export default router
