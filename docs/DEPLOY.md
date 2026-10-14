# Deploy — MongoDB Atlas + Vercel

Guía para Santiago. Se hace una vez; después cada push a `main` despliega solo.

## 0. Repo

El proyecto tiene que estar en su propio repo de GitHub, con la carpeta `mundo-mickey/` como raíz (donde está el `package.json`). Verificá que el `.env` **no** esté versionado.

## 1. MongoDB Atlas

1. Entrá a [cloud.mongodb.com](https://cloud.mongodb.com) y creá un proyecto "Mundo Mickey".
2. **Create cluster** → plan **M0 (Free)** → proveedor **AWS**, región **N. Virginia (us-east-1)**. Es la misma región que usan por defecto las funciones de Vercel.
3. **Database Access** → **Add New Database User**:
   - método: contraseña;
   - usuario: `mundo-mickey-app`;
   - contraseña generada (guardala, sin caracteres raros si podés);
   - rol: **Read and write to any database**.
4. **Network Access** → **Add IP Address** → **Allow access from anywhere** (`0.0.0.0/0`). Hace falta porque las funciones de Vercel no tienen IP fija.
5. **Connect** → **Drivers** → copiá la URI y agregale el nombre de la base `mundo-mickey` antes del `?`:
   ```
   mongodb+srv://mundo-mickey-app:<CONTRASEÑA>@<cluster>.xxxxx.mongodb.net/mundo-mickey?retryWrites=true&w=majority
   ```
   Si la contraseña tiene caracteres como `@`, `:` o `/`, codificalos (por ejemplo `@` → `%40`).
6. Pegá esa URI en tu `.env` local como `MONGODB_URI` y probá `npm run dev` → `http://localhost:5173/api/health` tiene que dar `"db": "conectada"`.

## 2. Vercel

1. [vercel.com/new](https://vercel.com/new) → importá el repo.
2. Configuración del proyecto:
   - **Root Directory:** la raíz del repo (donde está `package.json`).
   - **Framework Preset:** Vite (lo detecta solo). Build `npm run build`, output `dist`: no hace falta tocar nada.
3. **Environment Variables** — cargá cada una marcando **Production** y **Preview**:
   | Variable | Valor |
   |---|---|
   | `MONGODB_URI` | la URI del paso anterior |
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
- **CORS:** `http://localhost:5173` y `http://localhost:5174`, sin credentials (más el `http://localhost:3333` que Sanity crea por defecto).
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
