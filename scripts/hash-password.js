// Genera el hash bcrypt de la contraseña del admin, para ADMIN_PASSWORD_HASH.
// Uso: npm run admin:hash. La contraseña no se muestra al tipear y no se guarda en ningún lado.
import bcrypt from 'bcryptjs'

const COSTO = 12
const MINIMO = 12

// Sin terminal (stdin por pipe): se lee todo una vez y cada pregunta toma la línea siguiente
let lineasPipe = null
async function leerLineaPipe() {
  if (!lineasPipe) {
    let texto = ''
    for await (const trozo of process.stdin) texto += trozo
    lineasPipe = texto.split(/\r?\n/)
  }
  return lineasPipe.shift() ?? ''
}

/** Pide un texto por consola sin mostrarlo. */
async function preguntarOculto(pregunta) {
  process.stdout.write(pregunta)
  if (!process.stdin.isTTY) {
    const linea = await leerLineaPipe()
    process.stdout.write('\n')
    return linea
  }

  return new Promise((resolve, reject) => {
    const entrada = process.stdin
    let valor = ''
    const terminar = () => {
      entrada.off('data', alTeclear)
      entrada.setRawMode(false)
      entrada.pause()
      process.stdout.write('\n')
    }
    const alTeclear = (teclas) => {
      for (const c of teclas) {
        if (c === '\r' || c === '\n') {
          terminar()
          return resolve(valor)
        }
        if (c === '\u0003') {
          terminar()
          return reject(new Error('Cancelado.'))
        }
        if (c === '\u007f' || c === '\b') valor = valor.slice(0, -1)
        else if (c >= ' ') valor += c
      }
    }
    entrada.setRawMode(true)
    entrada.setEncoding('utf8')
    entrada.on('data', alTeclear)
    entrada.resume()
  })
}

async function main() {
  const password = await preguntarOculto('Contraseña nueva del admin: ')
  if (password.length < MINIMO) throw new Error(`La contraseña tiene que tener al menos ${MINIMO} caracteres.`)
  if (password !== password.trim()) throw new Error('La contraseña no puede empezar ni terminar con espacios.')

  const repetida = await preguntarOculto('Repetila: ')
  if (repetida !== password) throw new Error('Las contraseñas no coinciden.')

  const hash = await bcrypt.hash(password, COSTO)
  console.log('\nHash (va en ADMIN_PASSWORD_HASH):\n')
  console.log(hash)
  console.log('\nEn Vercel pegalo tal cual. En el .env, también sin comillas: dotenv no interpreta los "$".')
}

main().catch((err) => {
  console.error(`\n${err.message}`)
  process.exitCode = 1
})
