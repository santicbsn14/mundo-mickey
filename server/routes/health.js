import { Router } from 'express'
import { conectarDB, estadoDB } from '../config/db.js'

const router = Router()

router.get('/health', async (req, res) => {
  try {
    await conectarDB()
    res.json({ ok: true, db: estadoDB(), entorno: process.env.VERCEL_ENV ?? 'local' })
  } catch (err) {
    console.error('Health: no se pudo conectar a MongoDB:', err.message)
    res.status(500).json({ ok: false, db: 'desconectada', error: err.message })
  }
})

export default router
