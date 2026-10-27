import express from 'express'
import helmet from 'helmet'
import health from './routes/health.js'
import admin from './routes/admin.js'
import pagos from './routes/pagos.js'
import { manejarErrores, noEncontrado } from './middlewares/errores.js'

const app = express()

app.disable('x-powered-by')
// Detrás del proxy de Vercel: req.ip es la IP real del cliente (la usa el límite de intentos del login)
app.set('trust proxy', 1)
app.use(helmet())
app.use(express.json())

app.use('/api', health)
app.use('/api/admin', admin)
app.use('/api/pagos', pagos)

app.use('/api', noEncontrado)
app.use(manejarErrores)

// Sin app.listen: en Vercel la levanta api/index.js y en local server/dev.js
export default app
