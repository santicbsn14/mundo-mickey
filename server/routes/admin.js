import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { requiereAdmin } from '../middlewares/auth.js'
import { subidaImagen } from '../middlewares/subida.js'
import { login, sesion } from '../controllers/adminSesion.js'
import * as productos from '../controllers/adminProductos.js'
import { subirImagen } from '../controllers/adminImagenes.js'
import * as configuracion from '../controllers/adminConfiguracion.js'

const router = Router()

// 5 intentos fallidos por IP cada 15 minutos; los logins exitosos no cuentan.
// En serverless el contador vive en la memoria de cada instancia: es una protección parcial.
const limiteLogin = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Demasiados intentos. Probá de nuevo en unos minutos.' },
})

router.post('/login', limiteLogin, login)

// Todo lo que sigue (y cualquier otra ruta bajo /api/admin) exige el token
router.use(requiereAdmin)

router.get('/sesion', sesion)

router.get('/productos', productos.listar)
router.patch('/productos/orden', productos.reordenar)
router.get('/productos/:id', productos.ver)
router.post('/productos', productos.crear)
router.put('/productos/:id', productos.editar)
router.delete('/productos/:id', productos.eliminar)

router.post('/imagenes', subidaImagen, subirImagen)

router.get('/configuracion', configuracion.ver)
router.put('/configuracion', configuracion.guardar)

export default router
