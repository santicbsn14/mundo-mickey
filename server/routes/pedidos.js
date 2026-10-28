import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { estado } from '../controllers/pedidos.js'

const router = Router()

// 30 consultas por IP por minuto: la página de éxito consulta cada 3 s durante 60 s (20 veces).
// Como los otros límites, vive en la memoria de cada instancia.
const limiteEstado = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Demasiadas consultas. Probá de nuevo en un minuto.' },
})

router.get('/:id/estado', limiteEstado, estado)

export default router
