# Deploy — MongoDB Atlas + Vercel

Guía para Santiago. Se hace una vez; después cada push a `main` despliega solo.

## 0. Repo

El proyecto tiene que estar en su propio repo de GitHub, con la carpeta `mundo-mickey/` como raíz (donde está el `package.json`). Verificá que el `.env` **no** esté versionado.

## 1. MongoDB Atlas

### Desarrollo (provisorio)

Hoy la base de desarrollo es **provisoria**: la base `mundo-mickey` vive en un cluster que Santiago ya tenía en **otro proyecto de Atlas**, compartido con otros datos. Sirve para desarrollar en local, pero **no se usa en producción**. La URI está solo en el `.env` local.

- Los modelos y colecciones llegan desde el brief 08, así que en la base todavía no hay colecciones. Si algún día se pasan datos de desarrollo a producción, se exportan de esa base (`mongodump --db mundo-mickey`) y no del cluster entero.
- Si `/api/health` da `"db": "desconectada"` en local, revisá que el Network Access de ese otro proyecto deje entrar tu IP.

### Producción (brief 12): proyecto propio de la tienda

Antes del deploy hay que crear un proyecto de Atlas **propio de la tienda**, sin reutilizar el cluster de desarrollo. Así los datos de la tienda quedan separados, y el tier gratis permite un solo M0 por proyecto. Todo se hace desde la web, en [cloud.mongodb.com](https://cloud.mongodb.com):

1. **Proyecto:** en el selector de proyectos (arriba a la izquierda), **New Project** → nombre **"Mundo Mickey"** → **Create Project**.
2. **Cluster:** **Create** (o **Build a Database**):
   - plan **M0 (Free)**. Nada pago;
   - proveedor **AWS**, región **N. Virginia (us-east-1)**, la misma que usan por defecto las funciones de Vercel;
   - nombre `mundo-mickey`.

   Esperá a que el cluster figure como activo (tarda unos minutos).
3. **Usuario de la base:** **Security → Database Access → Add New Database User**:
   - método: **Password**;
   - usuario: `mundo-mickey-api`;
   - contraseña: **Autogenerate Secure Password**. Copiala en ese momento: después no se vuelve a ver. Si la generás a mano, que sea larga (32 caracteres) y solo con letras y números, así no hay que codificarla en la URI;
   - permisos: **Specific Privileges** (no uses "Atlas admin" ni "Read and write to any database") → **Add Specific Privilege** → rol `readWrite`, base `mundo-mickey` y colección vacía (toda la base);
   - **Add User**.
4. **Acceso de red:** **Security → Network Access → Add IP Address** → **Allow access from anywhere** (`0.0.0.0/0`), con el comentario "Vercel (IPs dinámicas)". Hace falta porque las funciones de Vercel no tienen IP fija. La seguridad queda en el usuario con permisos mínimos y la contraseña larga.
5. **Connection string:** en el cluster, **Connect → Drivers** → copiá la URI y completala:
   - reemplazá `<db_password>` por la contraseña;
   - poné el nombre de la base `mundo-mickey` después de `mongodb.net/` y antes del `?`;
   - dejá `retryWrites=true&w=majority&appName=mundo-mickey` en los parámetros.

   Queda con este formato (valores de ejemplo):
   ```
   mongodb+srv://mundo-mickey-api:<CONTRASEÑA>@mundo-mickey.xxxxx.mongodb.net/mundo-mickey?retryWrites=true&w=majority&appName=mundo-mickey
   ```
   Si la contraseña tiene caracteres como `@`, `:` o `/`, codificalos (por ejemplo `@` → `%40`).
6. **Dónde va:** la URI va en la variable `MONGODB_URI` de Vercel (ver paso 2), marcando **Production** y **Preview**. No la pegues en ningún archivo del repo.
7. **Probar antes del deploy (opcional):** poné esa URI en tu `.env` local, corré `npm run dev` y abrí `/api/health`. Tiene que dar `"db": "conectada"`, y en la consola tiene que decir `MongoDB conectada (base: mundo-mickey)`. Después volvé a la URI de desarrollo.

## 2. Vercel

1. [vercel.com/new](https://vercel.com/new) → importá el repo.
2. Configuración del proyecto:
   - **Root Directory:** la raíz del repo (donde está `package.json`).
   - **Framework Preset:** Vite (lo detecta solo). Build `npm run build`, output `dist`: no hace falta tocar nada.
3. **Environment Variables** — cargá cada una marcando **Production** y **Preview**:
   | Variable | Valor |
   |---|---|
   | `MONGODB_URI` | la URI del proyecto de Atlas propio (paso 1, "Producción"). No la de desarrollo |
   | `SITE_URL` | la URL del proyecto, por ejemplo `https://mundo-mickey.vercel.app` (sin `/` al final) |
   | `VITE_SANITY_PROJECT_ID` | `de0zicdv` |
   | `VITE_SANITY_DATASET` | `production` |
   | `SANITY_PROJECT_ID` | `de0zicdv` |
   | `SANITY_DATASET` | `production` |
   | `SANITY_WRITE_TOKEN` | el mismo valor de tu `.env` local (token Editor `mundo-mickey-api`) |
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
2. Abrí `https://<proyecto>.vercel.app/checkout` y **recargá la página** (F5). Tiene que seguir mostrando "Checkout": eso confirma que el rewrite a `/index.html` funciona.
3. Abrí `https://<proyecto>.vercel.app/admin` y fijate que se vea la barra negra del panel.

## 4. Problemas comunes

| Síntoma | Qué revisar |
|---|---|
| 404 en `/api/health` | Que `vercel.json` esté en la raíz y tenga el rewrite `/api/(.*)` → `/api`, y que exista `api/index.js`. |
| `"db": "desconectada"` | La `MONGODB_URI` (usuario, contraseña codificada, nombre de base) y que Network Access de Atlas tenga `0.0.0.0/0`. El campo `error` de la respuesta dice el motivo. |
| `Falta la variable de entorno MONGODB_URI` | La variable no está cargada para ese entorno (Production o Preview), o no se hizo Redeploy después de cargarla. |
| `"sanity": "error"` | El motivo está en `errores.sanity`. Revisá `SANITY_PROJECT_ID` y `SANITY_DATASET` en Vercel. |
| El front no carga productos (error de CORS en la consola) | Falta el dominio en los CORS de Sanity (ver la sección Sanity). |
| Una ruta del front da 404 al recargar | El rewrite `/(.*)` → `/index.html` en `vercel.json`. |
| Logs | Vercel → proyecto → **Logs**. En Hobby duran 1 hora. |

## Probar en el celular

Para ver la tienda de desarrollo en un celular real (deslizar la galería, el drawer del carrito, etc.), con el celular y la PC **en la misma red Wi-Fi**:

1. **Levantá Vite escuchando en la red.** `npm run dev -- --host` **no sirve**: `concurrently` se queda con el `--host` y Vite no lo recibe. Usá:
   ```bash
   npx vite --host
   ```
   La tienda lee Sanity directo, así que alcanza con Vite. Si hace falta la API (panel, checkout), corré `node --watch server/dev.js` en otra terminal.
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
