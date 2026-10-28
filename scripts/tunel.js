// Levanta un Cloudflare Quick Tunnel (https) hacia Vite, para probar Mercado Pago contra la PC.
// Uso: npm run tunel            → http://localhost:5173
//      npm run tunel -- 5174    → otro puerto (si Vite cayó en el 5174)
// Vite ya hace proxy de /api a la API, así que el webhook llega por el mismo túnel.
// La URL cambia en cada corrida: va en SITE_URL del .env (y se reinicia la API). Ver docs/DEPLOY.md.
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
// Fuera del repo: Mundo Mickey/herramientas/cloudflared.exe
const EXE = path.resolve(RAIZ, '..', 'herramientas', process.platform === 'win32' ? 'cloudflared.exe' : 'cloudflared')
const DESCARGA = 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe'

const puerto = process.argv[2] ?? '5173'
if (!/^\d{2,5}$/.test(puerto)) {
  console.error(`Puerto inválido: ${puerto}. Uso: npm run tunel -- 5174`)
  process.exit(1)
}

if (!existsSync(EXE)) {
  console.error(`No está ${EXE}.

Descargá el ejecutable portable (sin instalador) de los releases oficiales de Cloudflare:
  ${DESCARGA}
y guardalo con ese nombre en esa carpeta (fuera del repo). Ver "Probar pagos en la PC" en docs/DEPLOY.md.`)
  process.exit(1)
}

console.log(`Túnel hacia http://localhost:${puerto}. Esperá la línea con https://….trycloudflare.com y:
  1. poné esa URL (sin / al final) en SITE_URL del .env y reiniciá la API;
  2. sumá ese origen a los CORS de Sanity (ver docs/DEPLOY.md);
  3. abrí la tienda desde esa URL (no desde localhost).
Ctrl+C para cortarlo.
`)

const hijo = spawn(EXE, ['tunnel', '--no-autoupdate', '--url', `http://localhost:${puerto}`], { stdio: ['ignore', 'inherit', 'pipe'] })

// cloudflared escribe todo por stderr: se muestra tal cual y se resalta la URL
// (la del túnel, no la de api.trycloudflare.com, que aparece en los errores)
let avisado = false
hijo.stderr.on('data', (trozo) => {
  const texto = trozo.toString()
  process.stderr.write(texto)
  const url = !avisado && texto.match(/https:\/\/(?!api\.)[a-z0-9-]+\.trycloudflare\.com/)
  if (url) {
    avisado = true
    console.log(`\n  ➜  SITE_URL=${url[0]}\n`)
  }
  if (/lookup api\.trycloudflare\.com.*no such host/.test(texto)) {
    console.error(`
El DNS de esta red no resuelve trycloudflare.com (algunos routers y proveedores lo bloquean).
Usá otro DNS en Windows (por ejemplo 1.1.1.1 y 1.0.0.1) o probá desde otra red. Ver "Probar pagos en la PC" en docs/DEPLOY.md.`)
  }
})

const cortar = () => hijo.kill()
process.on('SIGINT', cortar)
process.on('SIGTERM', cortar)
hijo.on('exit', (codigo) => process.exit(codigo ?? 0))
