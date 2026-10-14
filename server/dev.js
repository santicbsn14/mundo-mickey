// Solo para desarrollo local. En Vercel la entrada es api/index.js.
import 'dotenv/config'
import app from './app.js'

const PUERTO = 4000

app.listen(PUERTO, () => {
  console.log(`API en http://localhost:${PUERTO}`)
})
