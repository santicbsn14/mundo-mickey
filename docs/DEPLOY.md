# Deploy — MongoDB Atlas + Vercel

Guía para Santiago. Se hace una vez; después cada push a `main` despliega solo.

## 0. Repo

El proyecto tiene que estar en su propio repo de GitHub, con la carpeta `mundo-mickey/` como raíz (donde está el `package.json`). Verificá que el `.env` **no** esté versionado.

## 1. MongoDB Atlas

La base vive en el **Atlas del dueño**: organización propia, proyecto y cluster `mundo-mickey` (M0 gratis, **AWS N. Virginia (us-east-1)**, la misma región por defecto de las funciones de Vercel). Desarrollo y producción usan **el mismo cluster y el mismo usuario**, cada uno con su base:

| Entorno | Base | Dónde va la URI |
|---|---|---|
| Local | `mundo-mickey-dev` | `MONGODB_URI` del `.env` |
| Producción (Vercel) | `mundo-mickey` | `MONGODB_URI` de Vercel (Production y Preview) |

Así los pedidos de prueba nunca se mezclan con los reales. Las URIs solo están en el `.env` y en Vercel: no las pegues en ningún archivo del repo.

- **Acceso de red:** Security → Network Access tiene `0.0.0.0/0` ("Vercel, IPs dinámicas"). Hace falta porque las funciones de Vercel no tienen IP fija, y de paso sirve para desarrollar desde cualquier red. La seguridad queda en el usuario y su contraseña larga.
- **Usuario:** Security → Database Access. Tiene que poder leer y escribir **las dos bases** (`readWrite` en `mundo-mickey` y en `mundo-mickey-dev`). Si se cambia la contraseña, hay que actualizarla en el `.env` y en Vercel (y hacer Redeploy).
- **Colecciones:** las crea la API sola al guardar el primer pedido (`pedidos`, `counters`). El contador de pedidos (`counters`, `_id: "pedido"`) es uno por base: borrarlo en una base hace que el próximo pedido de esa base sea el #0001.

### Connection string

En el cluster, **Connect → Drivers**:

- **Vercel:** el formato `mongodb+srv://` que muestra por defecto. Reemplazá `<db_password>` y poné la base después de `mongodb.net/` y antes del `?`:
  ```
  mongodb+srv://<usuario>:<CONTRASEÑA>@mundo-mickey.xxxxx.mongodb.net/mundo-mickey?retryWrites=true&w=majority&appName=mundo-mickey
  ```
- **Local (PC de Santiago):** la **cadena estándar** `mongodb://`, con los tres hosts. En **Connect → Drivers**, elegí la versión del driver **"2.2.12 or later"** y copiá la que aparece. Queda con este formato (valores de ejemplo), con la base `mundo-mickey-dev`:
  ```
  mongodb://<usuario>:<CONTRASEÑA>@ac-xxxxxxx-shard-00-00.xxxxx.mongodb.net:27017,ac-xxxxxxx-shard-00-01.xxxxx.mongodb.net:27017,ac-xxxxxxx-shard-00-02.xxxxx.mongodb.net:27017/mundo-mickey-dev?ssl=true&replicaSet=atlas-xxxxxx-shard-0&authSource=admin&retryWrites=true&w=majority
  ```
  Hace falta porque el DNS de esa red no resuelve los registros SRV y el formato `+srv` falla con `querySrv ECONNREFUSED` (ver "Problemas comunes"). Las dos cadenas apuntan al mismo cluster.

Si la contraseña tiene caracteres como `@`, `:` o `/`, codificalos (por ejemplo `@` → `%40`).

**Probar:** `npm run dev` y abrí `/api/health`. Tiene que dar `"db": "conectada"`, y la consola de la API tiene que decir `MongoDB conectada (base: mundo-mickey-dev)` (en local) o `mundo-mickey` (en Vercel).

## 2. Vercel

1. [vercel.com/new](https://vercel.com/new) → importá el repo.
2. Configuración del proyecto:
   - **Root Directory:** la raíz del repo (donde está `package.json`).
   - **Framework Preset:** Vite (lo detecta solo). Build `npm run build`, output `dist`: no hace falta tocar nada.
3. **Environment Variables** — cargá cada una marcando **Production** y **Preview**:
   | Variable | Valor |
   |---|---|
   | `MONGODB_URI` | la URI `mongodb+srv://` con la base **`mundo-mickey`** (paso 1). No la de desarrollo (`mundo-mickey-dev`) |
   | `SITE_URL` | la URL pública del sitio, sin `/` al final: el **dominio final** (brief 12), o mientras tanto la del proyecto (`https://mundo-mickey.vercel.app`). Arma las `back_urls` y la `notification_url` de Mercado Pago, que solo se manda si empieza con `https://` |
   | `MP_ACCESS_TOKEN` | el Access Token **de producción de la cuenta real de Mercado Pago del dueño** (Tus integraciones → la aplicación → Credenciales de producción). No el de la cuenta de prueba que se usa en local. Es secreto: nunca con `VITE_` |
   | `MP_WEBHOOK_SECRET` | la **clave secreta de los webhooks en modo productivo** (ver "Webhooks en producción" en "Probar pagos en la PC"). No la de modo prueba que se usa en local. Sin ella, el webhook responde 500 y Mercado Pago reintenta |
   | `VITE_SANITY_PROJECT_ID` | `de0zicdv` |
   | `VITE_SANITY_DATASET` | `production` |
   | `SANITY_PROJECT_ID` | `de0zicdv` |
   | `SANITY_DATASET` | `production` |
   | `SANITY_WRITE_TOKEN` | el mismo valor de tu `.env` local (token Editor `mundo-mickey-api`) |
   | `ADMIN_USER` | el usuario del panel (por ejemplo `admin`) |
   | `ADMIN_PASSWORD_HASH` | el hash de la contraseña de **producción**, que elegís vos: corré `npm run admin:hash`, escribila dos veces y pegá el hash que imprime, tal cual y sin comillas. **No uses la contraseña de desarrollo** del `.env` local |
   | `JWT_SECRET` | uno **nuevo**, distinto del de desarrollo: `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`. Si lo cambiás, todas las sesiones abiertas se cierran |
4. **Deploy.** Si cambiás variables después, hacé **Redeploy**: no se aplican a deploys anteriores.

> **Plan:** Hobby es solo para uso personal y **no comercial**. Para probar alcanza, pero para la tienda en vivo corresponde **Pro**.

## Sanity

- **Proyecto:** "Mundo Mickey", Project ID **`de0zicdv`**, en la organización `santicbsn14`. Panel: https://www.sanity.io/manage/project/de0zicdv
- **Dataset `production` público:** el front lo lee sin token, por el CDN. No se usa Sanity Studio: todo se carga desde `/admin`.
- **CORS:** solo `http://localhost:5173` y `http://localhost:5174`, sin credentials. El `http://localhost:3333` que Sanity crea por defecto (el de Studio) se borró en el brief 02b.
- **Token:** `mundo-mickey-api`, rol Editor. Va solo en `SANITY_WRITE_TOKEN` (`.env` y Vercel). Si se filtra, revocalo en el panel (API → Tokens) y creá otro.
- **Brief 12 — dominio de producción:** hay que sumarlo a los CORS (sin credentials, porque el front solo lee). Desde la raíz del repo:
  ```bash
  npx sanity@latest cors add https://<dominio> --no-credentials --project-id de0zicdv
  npx sanity@latest cors list --project-id de0zicdv
  ```
  Si se sigue usando la URL `*.vercel.app`, agregala también.

## 3. Verificar

1. Abrí `https://<proyecto>.vercel.app/api/health`. Tiene que responder:
   ```json
   { "ok": true, "db": "conectada", "sanity": "ok", "entorno": "production" }
   ```
2. Abrí `https://<proyecto>.vercel.app/checkout` y **recargá la página** (F5). Tiene que seguir mostrando "Finalizar compra" (o "Tu carrito está vacío"): eso confirma que el rewrite a `/index.html` funciona.
3. Abrí `https://<proyecto>.vercel.app/admin` y fijate que se vea la barra negra del panel.

## 4. Problemas comunes

| Síntoma | Qué revisar |
|---|---|
| 404 en `/api/health` | Que `vercel.json` esté en la raíz y tenga el rewrite `/api/(.*)` → `/api`, y que exista `api/index.js`. |
| `querySrv ECONNREFUSED` (en local, al conectar a Mongo) | El DNS de la red no resuelve los registros SRV del formato `mongodb+srv://`. Usá la cadena estándar `mongodb://` con los tres hosts (Connect → Drivers → versión "2.2.12 or later"; ver paso 1). En Vercel no pasa. |
| `"db": "desconectada"` | La `MONGODB_URI` (usuario, contraseña codificada, nombre de base) y que Network Access de Atlas tenga `0.0.0.0/0`. El campo `error` de la respuesta dice el motivo. |
| `Falta la variable de entorno MONGODB_URI` | La variable no está cargada para ese entorno (Production o Preview), o no se hizo Redeploy después de cargarla. |
| `"sanity": "error"` | El motivo está en `errores.sanity`. Revisá `SANITY_PROJECT_ID` y `SANITY_DATASET` en Vercel. |
| El front no carga productos (error de CORS en la consola) | Falta el dominio en los CORS de Sanity (ver la sección Sanity). |
| Una ruta del front da 404 al recargar | El rewrite `/(.*)` → `/index.html` en `vercel.json`. |
| Logs | Vercel → proyecto → **Logs**. En Hobby duran 1 hora. |

## Probar en el celular

Para ver la tienda o el panel de desarrollo en un celular real (deslizar la galería, el drawer del carrito, el login, etc.), con el celular y la PC **en la misma red Wi-Fi**:

1. **Levantá todo escuchando en la red:**
   ```bash
   npm run dev:host
   ```
   Es igual a `npm run dev` (Vite + API), pero con Vite en `--host`. La API no hace falta exponerla: el celular le habla a Vite y Vite le pasa `/api` a la API por el proxy. (`npm run dev -- --host` **no sirve**: `concurrently` se queda con el `--host` y Vite no lo recibe.)
2. **Abrí la URL de red** que muestra Vite (`➜  Network: http://192.168.x.x:5173/`) desde el navegador del celular. El puerto es el 5173, o el 5174 si el 5173 está ocupado. Si Windows pregunta por el firewall, permití Node.js en **redes privadas**.
3. **Sumá ese origen a los CORS de Sanity** (si no, el catálogo dice "No pudimos cargar los productos."). Con la IP y el puerto exactos, desde la raíz del repo:
   ```bash
   npx sanity@latest cors add http://192.168.x.x:5173 --no-credentials --project-id de0zicdv
   ```
4. **Al terminar, sacalo:** la IP de la PC cambia, y no conviene dejar orígenes viejos.
   ```bash
   npx sanity@latest cors delete http://192.168.x.x:5173 --project-id de0zicdv
   npx sanity@latest cors list --project-id de0zicdv
   ```
   Tienen que quedar solo `http://localhost:5173` y `http://localhost:5174`.

## Probar pagos en la PC

Mercado Pago no llega a `localhost`: para que mande el webhook y vuelva a `/pago/exito` hace falta una URL **https** pública que apunte a la PC. Se usa un **Cloudflare Quick Tunnel** (gratis, sin cuenta).

### Una sola vez

1. **`cloudflared`:** el ejecutable portable para Windows, **sin instalador**, de los releases oficiales de Cloudflare: [cloudflared-windows-amd64.exe](https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe). Guardalo como `C:UsersAdminProyectosMundo Mickeyherramientascloudflared.exe` (fuera del repo: **no se commitea**).
2. **Cuentas de prueba:** en [mercadopago.com.ar/developers](https://www.mercadopago.com.ar/developers) → **Tus integraciones** → la aplicación → **Cuentas de prueba**, tienen que estar la **vendedor** (su Access Token de producción va en `MP_ACCESS_TOKEN` del `.env`) y la **comprador** (con ella se paga). Anotá usuario y contraseña de la comprador: se usan para entrar al checkout.

### Cada vez que probás

1. **Levantá todo:** `npm run dev` (Vite + API). Fijate en qué puerto quedó Vite (5173, o 5174 si el 5173 está ocupado).
2. **Levantá el túnel** en otra terminal:
   ```bash
   npm run tunel           # apunta a http://localhost:5173
   npm run tunel -- 5174   # si Vite está en el 5174
   ```
   Esperá la línea `➜  SITE_URL=https://xxxx-xxxx.trycloudflare.com`. **La URL cambia en cada corrida.** El túnel apunta a Vite, que ya le pasa `/api` a la API, así que el webhook entra por el mismo lado. Vite acepta los hosts `.trycloudflare.com` (`server.allowedHosts` en `vite.config.ts`, solo en desarrollo).
3. **`SITE_URL`:** poné esa URL en el `.env` (`SITE_URL=https://xxxx-xxxx.trycloudflare.com`, sin `/` al final) y **reiniciá la API** (cortá y volvé a correr `npm run dev`). Con https, la preferencia ya lleva la `notification_url` (`<SITE_URL>/api/pagos/webhook?source_news=webhooks`).
4. **CORS de Sanity:** el catálogo se lee desde el navegador, así que sumá el origen del túnel (si no, la tienda dice "No pudimos cargar los productos."):
   ```bash
   npx sanity@latest cors add https://xxxx-xxxx.trycloudflare.com --no-credentials --project-id de0zicdv
   ```
5. **Webhook en modo prueba** (la URL cambió, así que hay que actualizarla cada vez): [mercadopago.com.ar/developers](https://www.mercadopago.com.ar/developers) → **Tus integraciones** → la aplicación → **Webhooks** → **Configurar notificaciones** → pestaña **Modo prueba**:
   - URL: `https://xxxx-xxxx.trycloudflare.com/api/pagos/webhook`;
   - evento: **Pagos**;
   - guardá y copiá la **clave secreta** a `.env` como `MP_WEBHOOK_SECRET=…` (sin comillas) y reiniciá la API. Si la clave cambia (o la regenerás), actualizala en el `.env`.
   - Si usás "Simular notificación" con un id de pago que no existe, la API lo registra como `ignorado` y responde 200.
6. **Comprá desde la URL del túnel** (no desde `localhost`): el carrito y los datos del checkout se guardan por origen, y Mercado Pago vuelve al túnel. Pagá logueado con la **cuenta de prueba comprador** y una tarjeta de prueba (abajo).
7. **Revisá:** el pedido en `mundo-mickey-dev` (`estado`, `mp`, `stockDescontado`, `notaInterna`), el stock en Sanity y la colección `eventowebhooks` (cada notificación con su `resultado`).

### Al terminar

1. `SITE_URL=http://localhost:5173` de vuelta en el `.env` y reiniciá la API.
2. Sacá el origen del túnel de los CORS de Sanity:
   ```bash
   npx sanity@latest cors delete https://xxxx-xxxx.trycloudflare.com --project-id de0zicdv
   npx sanity@latest cors list --project-id de0zicdv
   ```
   Tienen que quedar solo `http://localhost:5173` y `http://localhost:5174`.
3. Cortá el túnel (Ctrl+C). Borrá los pedidos, los `eventowebhooks` y el contador (`counters`, `_id: "pedido"`) de `mundo-mickey-dev`, y dejá el stock como el seed (`npm run seed`).

### Tarjetas de prueba (Argentina)

Tabla vigente de la [documentación de Mercado Pago Argentina](https://www.mercadopago.com.ar/developers/es/docs/your-integrations/test/cards). Cualquier tarjeta sirve con cualquier resultado: **el resultado lo decide el nombre del titular**.

| Tipo | Marca | Número | Código de seguridad | Vencimiento |
|---|---|---|---|---|
| Crédito | Mastercard | 5031 7557 3453 0604 | 123 | 11/30 |
| Crédito | Visa | 4509 9535 6623 3704 | 123 | 11/30 |
| Crédito | American Express | 3711 803032 57522 | 1234 | 11/30 |
| Débito | Mastercard | 5287 3383 1025 3304 | 123 | 11/30 |
| Débito | Visa | 4002 7686 9439 5619 | 123 | 11/30 |

| Resultado | Nombre y apellido del titular | Documento |
|---|---|---|
| Pago aprobado | `APRO` | DNI 12345678 |
| Rechazado por error general | `OTHE` | DNI 12345678 |
| Pendiente de pago | `CONT` | — |
| Rechazado con validación para autorizar | `CALL` | — |
| Rechazado por importe insuficiente | `FUND` | — |
| Rechazado por código de seguridad inválido | `SECU` | — |
| Rechazado por fecha de vencimiento | `EXPI` | — |
| Rechazado por error de formulario | `FORM` | — |

Para probar un rechazo y después el pago: pagá con `OTHE`, y en la misma pantalla de Mercado Pago reintentá con `APRO` (o volvé desde `/pago/error` con "Volver a intentar", que arma un pedido nuevo).

### Si el túnel no levanta

| Síntoma | Qué hacer |
|---|---|
| `lookup api.trycloudflare.com: no such host` | El DNS de la red no resuelve `trycloudflare.com` (algunos routers y proveedores lo bloquean; pasa en la red de la PC de Santiago). Cambiá el DNS del adaptador de red de Windows a `1.1.1.1` y `1.0.0.1` (Configuración → Red e Internet → la conexión → Asignación de servidor DNS → Manual), o probá desde otra red (por ejemplo, compartiendo internet del celular). |
| `Blocked request. This host (…) is not allowed` | Vite no tiene `.trycloudflare.com` en `server.allowedHosts`, o el túnel apunta a otro servidor. |
| El webhook no llega | Que la URL de **Modo prueba** en Webhooks sea la del túnel actual, y que `SITE_URL` también (y la API reiniciada). En `eventowebhooks` se ve si llegó y con qué resultado. |
| `firma_invalida` en `eventowebhooks` | `MP_WEBHOOK_SECRET` no es la clave de **Modo prueba** de esa aplicación, o no se reinició la API después de cambiarla. |
| Responde 500 "Webhook sin configurar." | Falta `MP_WEBHOOK_SECRET` en el `.env`. |

### Webhooks en producción (brief 12)

La misma configuración, en la pestaña **Modo productivo**, en la aplicación de la **cuenta real del dueño**: URL `https://<dominio final>/api/pagos/webhook`, evento **Pagos**. Su **clave secreta** va en `MP_WEBHOOK_SECRET` de Vercel (Production y Preview) y después hay que hacer **Redeploy**. La de modo prueba no sirve en producción.
