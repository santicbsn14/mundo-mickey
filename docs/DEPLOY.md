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

> **Hoy hay un deploy de prueba** en `https://mundo-mickey.vercel.app` (brief 11): usa la base **`mundo-mickey-dev`**, las **credenciales de prueba** de Mercado Pago y las credenciales de admin de desarrollo. Sirve para probar pagos de punta a punta. El paso a producción (base `mundo-mickey`, credenciales de producción, admin nuevo, dominio) es el brief 12: en la tabla, la columna "Producción".

Lo que se hizo para el deploy de prueba:

1. [vercel.com/new](https://vercel.com/new) → **Import** del repo de GitHub `santicbsn14/mundo-mickey`, rama `main`.
2. Configuración del proyecto:
   - **Root Directory:** la raíz del repo (donde está `package.json`).
   - **Framework Preset:** Vite (lo detecta solo). Build `npm run build`, output `dist`: no hace falta tocar nada.
3. **Environment Variables:** se pegaron todas (el `.env` se puede pegar entero en el primer campo y Vercel lo separa), marcando **Production** y **Preview**. **Sin comillas ni espacios:** Vercel guarda el valor tal cual.
4. **Deploy.** Con la URL ya conocida, se cargó `SITE_URL=https://mundo-mickey.vercel.app` y se hizo **Redeploy**: las variables no se aplican a deploys anteriores.
5. **CORS de Sanity:** se sumó el origen del deploy (ver la sección Sanity):
   ```bash
   npx sanity@latest cors add https://mundo-mickey.vercel.app --no-credentials --project-id de0zicdv
   ```
6. **Atlas:** Network Access con `0.0.0.0/0` (paso 1).
7. Verificar (paso 3): `/api/health` con `mp: "ok"` y `mpWebhook: "configurado"`.

**Variables:**

| Variable | Deploy de prueba (hoy) | Producción (brief 12) |
|---|---|---|
| `MONGODB_URI` | la URI `mongodb+srv://` con la base **`mundo-mickey-dev`** | la misma con la base **`mundo-mickey`** (paso 1) |
| `SITE_URL` | `https://mundo-mickey.vercel.app` | el **dominio final**. En los dos casos: con `https://`, sin `/` al final. Arma las `back_urls` y la `notification_url` de Mercado Pago; **si no empieza con `https://`, la preferencia sale sin webhook ni vuelta al sitio** (la API saca espacios y comillas, pero no agrega el `https://`) |
| `MP_ACCESS_TOKEN` | el Access Token de las **credenciales de prueba** de la aplicación "Mundo Mickey" (empieza con `APP_USR-`) | el de las **credenciales de producción** de la misma aplicación. Es secreto: nunca con `VITE_` |
| `MP_WEBHOOK_SECRET` | la **clave secreta de Webhooks en modo prueba** | la de **modo productivo**. Sin ella, el webhook responde 500 y Mercado Pago reintenta; con una clave equivocada, 401 (`firma_invalida`) |
| `VITE_SANITY_PROJECT_ID` / `SANITY_PROJECT_ID` | `de0zicdv` | igual |
| `VITE_SANITY_DATASET` / `SANITY_DATASET` | `production` | igual |
| `SANITY_WRITE_TOKEN` | el mismo valor del `.env` local (token Editor `mundo-mickey-api`) | igual |
| `ADMIN_USER` | el de desarrollo | el usuario del panel (por ejemplo `admin`) |
| `ADMIN_PASSWORD_HASH` | el de desarrollo | el hash de la contraseña de **producción**, que elegís vos: `npm run admin:hash`, escribila dos veces y pegá el hash tal cual, sin comillas. **No la contraseña de desarrollo** |
| `JWT_SECRET` | el de desarrollo | uno **nuevo**: `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`. Si lo cambiás, se cierran todas las sesiones |

Si cambiás variables después, hacé **Redeploy**: no se aplican a deploys anteriores.

> **Plan:** Hobby es solo para uso personal y **no comercial**. Para probar alcanza, pero para la tienda en vivo corresponde **Pro**.

## Sanity

- **Proyecto:** "Mundo Mickey", Project ID **`de0zicdv`**, en la organización `santicbsn14`. Panel: https://www.sanity.io/manage/project/de0zicdv
- **Dataset `production` público:** el front lo lee sin token, por el CDN. No se usa Sanity Studio: todo se carga desde `/admin`.
- **CORS:** `http://localhost:5173`, `http://localhost:5174` y el deploy de prueba `https://mundo-mickey.vercel.app` (brief 11), sin credentials. El `http://localhost:3333` que Sanity crea por defecto (el de Studio) se borró en el brief 02b.
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
   { "ok": true, "db": "conectada", "sanity": "ok", "mp": "ok", "mpWebhook": "configurado", "entorno": "production" }
   ```
   - `mp`: `"ok"` si el token anda (consulta `GET /users/me` de Mercado Pago, con 3 s de límite), `"error"` con el motivo en `errores.mp` (sin el token), o `"sin_configurar"`. No cambia `ok` ni el código de respuesta.
   - `mpWebhook`: `"configurado"`, `"sin_configurar"` o `"invalido"` (la clave tiene caracteres que una clave real no tiene: por ejemplo, se copió tapada con "•").
   - En el **log** de la función (no en la respuesta) queda el prefijo del token, si la cuenta es de prueba (`usuario DE PRUEBA`, por el tag `test_user` de `users/me`) y el `SITE_URL` exacto.
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
| `"mp": "error"` | El motivo en `errores.mp`: con 401, el `MP_ACCESS_TOKEN` está mal copiado o se regeneró; con "no respondió a tiempo", Mercado Pago tardó más de 3 s (probá de nuevo). |
| `"mpWebhook": "invalido"` | La clave se copió **tapada** (los "•" del panel). En Mercado Pago, Webhooks → la pestaña del modo → mostrá la clave (el ojo) y copiala. Pegala en Vercel y hacé Redeploy. |
| La preferencia sale sin `back_urls` ni `notification_url`; Mercado Pago no vuelve a la tienda | `SITE_URL` no empieza con `https://` en ese entorno (o no se hizo Redeploy). Se ve en el log de `/api/health` (`SITE_URL: "…"`) y, en el checkout, como error en el log. |
| Mercado Pago dice "Una de las partes con la que intentás hacer el pago es de prueba" | Se está pagando con una cuenta **real** (logueado, o con un email de una cuenta real) a un vendedor de prueba. Pagá en una ventana de incógnito, **sin iniciar sesión** y con un email inventado (ver "Probar pagos"). |
| Todos los eventos son `firma_invalida` | `MP_WEBHOOK_SECRET` no es la clave del modo que corresponde (prueba en el deploy de prueba, productivo en producción), o se copió tapada. Los eventos con firma inválida guardan el `x-signature` recibido (un HMAC, no la clave) para comparar. Mientras tanto, los pagos se confirman igual por la reconciliación de `/pago/exito`. |
| Logs | Vercel → proyecto → **Logs** (o Deployments → el deploy → **Logs**). En Hobby duran 1 hora; para el webhook, mirá la colección `eventowebhooks`. |

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
   Tienen que quedar `http://localhost:5173`, `http://localhost:5174` y `https://mundo-mickey.vercel.app`.

## Pedidos de prueba

`npm run pedidos:prueba` crea 10 pedidos inventados (todos los estados, con los productos del catálogo y sin tocar el stock) para probar el panel; `npm run pedidos:prueba -- --borrar` borra todos los pedidos y el contador. **Solo corre si la base de `MONGODB_URI` termina en `-dev`.**

## Mercado Pago (panel nuevo)

La integración es **Checkout Pro** en la **cuenta real del dueño (Camilo)**. El panel nuevo de Mercado Pago **ya no obliga a usar cuentas de prueba vendedor/comprador**: la aplicación tiene sus propias credenciales de prueba.

1. [mercadopago.com.ar/developers](https://www.mercadopago.com.ar/developers) → **Tus integraciones** → **Crear aplicación**: nombre **"Mundo Mickey"**, producto **Checkout Pro**.
2. En la aplicación → **Credenciales de prueba** → **Activar credenciales**. El **Access Token** (empieza con `APP_USR-`, igual que el de producción) va en `MP_ACCESS_TOKEN`. Por detrás, Mercado Pago le asigna a la aplicación un **usuario vendedor de prueba**: `GET /users/me` con ese token devuelve el tag `test_user`, y el log de `/api/health` dice `usuario DE PRUEBA`. Por eso **el prefijo no alcanza para saber si un token es de prueba**.
3. **Webhooks** → **Configurar notificaciones** → pestaña **Modo prueba**: URL `https://mundo-mickey.vercel.app/api/pagos/webhook`, evento **Pagos**, guardar. Mostrá la **clave secreta** con el ojo (no la copies tapada: copia los "•") y pegala en `MP_WEBHOOK_SECRET` (Vercel + Redeploy, y el `.env` local).
4. **Producción (brief 12):** "Credenciales de producción" de la misma aplicación y la pestaña **Modo productivo** de Webhooks con el dominio final; su clave va en `MP_WEBHOOK_SECRET` de producción.

Notas:
- Además de la URL del panel, cada preferencia lleva su propia `notification_url` (con `?source_news=webhooks`). Con el webhook respondiendo 200 llega **una** notificación por pago; si responde 401 o 500, Mercado Pago reintenta enseguida y después durante horas (las repetidas no hacen nada).
- Con las credenciales de prueba, Mercado Pago firma con la clave de **Modo prueba** (verificado en el brief 12).
- Los pagos con las credenciales de prueba llegan con `live_mode: true`: no es una señal de pago real.
- **Alternativa (si la aplicación no tiene credenciales de prueba):** las cuentas de prueba de "Tus integraciones" → **Cuentas de prueba**: el Access Token de producción de la **vendedor** en `MP_ACCESS_TOKEN`, y se paga logueado con la **comprador**.

## Probar pagos en el deploy de Vercel (recomendado)

Con el deploy de prueba (base `mundo-mickey-dev`, credenciales de prueba) no hace falta túnel: Mercado Pago llega al webhook y vuelve al sitio.

1. Fijate que `/api/health` diga `mp: "ok"` y `mpWebhook: "configurado"`.
2. Abrí una **ventana de incógnito nueva**, **sin sesión de Mercado Pago**. Si pagás logueado con tu cuenta real, Mercado Pago lo rechaza ("Una de las partes con la que intentás hacer el pago es de prueba"). No hace falta cuenta comprador de prueba.
3. Comprá en `https://mundo-mickey.vercel.app` con un **email inventado** (por ejemplo `test_user_mm1@testuser.com`), no el tuyo.
4. En Mercado Pago, pagá **como invitado** con una tarjeta de prueba (abajo); el resultado lo decide el **nombre del titular**.
5. **Revisá:** el pedido en `mundo-mickey-dev` (`estado`, `mp`, `stockDescontado`, `notaInterna`), el stock en Sanity y `eventowebhooks` (cada notificación con su `resultado`, `firmaValida` y `duracionMs`).
6. **Al terminar:** `npm run pedidos:prueba -- --borrar` (pedidos y contador), vaciá `eventowebhooks` y `npm run seed` (stock).

Un pago rechazado y el reintento: con `OTHE` vuelve a `/pago/error` con el carrito; "Volver a intentar" arma **un pedido nuevo**, y el rechazado queda en "Pendientes de pago" (su preferencia vence a las 24 h).

## Probar pagos en la PC (alternativa, con túnel)

Mercado Pago no llega a `localhost`: para que mande el webhook y vuelva a `/pago/exito` hace falta una URL **https** pública que apunte a la PC. Se usa un **Cloudflare Quick Tunnel** (gratis, sin cuenta). Con `SITE_URL=http://localhost:…`, Mercado Pago rechaza `auto_return` y descarta las `back_urls`: la API crea la preferencia sin ellas (sirve solo para ver la preferencia).

### Una sola vez

1. **`cloudflared`:** el ejecutable portable para Windows, **sin instalador**, de los releases oficiales de Cloudflare: [cloudflared-windows-amd64.exe](https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe). Guardalo como `Mundo Mickey/herramientas/cloudflared.exe` (fuera del repo: **no se commitea**).
2. **Credenciales:** las de prueba de la aplicación en el `.env` (ver "Mercado Pago (panel nuevo)").

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
6. **Comprá desde la URL del túnel** (no desde `localhost`): el carrito y los datos del checkout se guardan por origen, y Mercado Pago vuelve al túnel. Pagá en incógnito, sin sesión de Mercado Pago, como invitado y con una tarjeta de prueba (abajo).
7. **Revisá:** el pedido en `mundo-mickey-dev` (`estado`, `mp`, `stockDescontado`, `notaInterna`), el stock en Sanity y la colección `eventowebhooks` (cada notificación con su `resultado`).

### Al terminar

1. `SITE_URL=http://localhost:5173` de vuelta en el `.env` y reiniciá la API.
2. Sacá el origen del túnel de los CORS de Sanity:
   ```bash
   npx sanity@latest cors delete https://xxxx-xxxx.trycloudflare.com --project-id de0zicdv
   npx sanity@latest cors list --project-id de0zicdv
   ```
   Tienen que quedar `http://localhost:5173`, `http://localhost:5174` y `https://mundo-mickey.vercel.app`.
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

Para probar un rechazo y después el pago: pagá con `OTHE`, y en la misma pantalla de Mercado Pago reintentá con `APRO` (o volvé desde `/pago/error` con "Volver a intentar", que arma un pedido nuevo). Verificado en el brief 11.

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
