import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { checkout, webhook } from '../controllers/pagos.js'

const router = Router()

// 10 pedidos por IP cada 10 minutos (cuentan todos los intentos). Como el del login, vive en la memoria
// de cada instancia: frena a un script que crea pedidos en serie, no a un ataque distribuido.
const limitePedidos = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Hiciste muchos pedidos seguidos. Esperá unos minutos.' },
})

router.post('/checkout', limitePedidos, checkout)
// Sin límite ni login: lo protege la firma de Mercado Pago
router.post('/webhook', webhook)

export default router
