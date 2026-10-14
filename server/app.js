import express from 'express'
import helmet from 'helmet'
import health from './routes/health.js'
import { manejarErrores, noEncontrado } from './middlewares/errores.js'

const app = express()

app.disable('x-powered-by')
app.use(helmet())
app.use(express.json())

app.use('/api', health)

app.use('/api', noEncontrado)
app.use(manejarErrores)

// Sin app.listen: en Vercel la levanta api/index.js y en local server/dev.js
export default app
