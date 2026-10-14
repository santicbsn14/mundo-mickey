import { Router } from 'express'
import { conectarDB, estadoDB } from '../config/db.js'
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
  // Sanity se consulta en paralelo con la conexión a Mongo
  const sanity = chequearSanity()
  const extraSanity = (s) => ({
    sanity: s.sanity,
    ...(s.error && { errores: { sanity: s.error } }),
  })

  try {
    await conectarDB()
  } catch (err) {
    console.error('Health: no se pudo conectar a MongoDB:', err.message)
    const s = await sanity
    return res.status(500).json({ ok: false, db: 'desconectada', error: err.message, ...extraSanity(s) })
  }

  // Mongo bien: si falla Sanity igual responde 200, con ok: false y el motivo
  const s = await sanity
  res.json({
    ok: s.sanity === 'ok',
    db: estadoDB(),
    ...extraSanity(s),
    entorno: process.env.VERCEL_ENV ?? 'local',
  })
})

export default router
