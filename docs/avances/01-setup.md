# Avance 01 — Setup del proyecto

## Qué se hizo
- Proyecto Vite + React + TypeScript estricto en la raíz del repo (`mundo-mickey/`), con un único `package.json` para el front y la API.
- Tokens de diseño y estilos base sacados de la maqueta: solo amarillo, negro y blanco, Bricolage Grotesque, foco visible y `prefers-reduced-motion`. Sin modo oscuro.
- Layout de la tienda (Header sticky con nav desktop y botón Carrito en 0, Footer con `id="contacto"`) y layout del panel (barra negra con NavLink activo y scroll horizontal en mobile).
- Todas las rutas de la tienda y del panel con su placeholder, más NotFound.
- API Express en `server/`, expuesta como una sola Vercel Function en `api/index.js`. Conexión a MongoDB cacheada en `globalThis` y `GET /api/health`.
- `npm run dev` levanta Vite (5173) y la API (4000) con `concurrently`, y Vite hace proxy de `/api`.
- Guía de deploy para Santiago en `docs/DEPLOY.md`.

## Archivos creados / modificados
- `package.json` / `package-lock.json` — dependencias y scripts `dev`, `build` y `preview`.
- `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json` — TS estricto. `app` cubre solo `src/`; `node` cubre solo `vite.config.ts`.
- `vite.config.ts` — plugin de React y proxy `/api` → `http://localhost:4000`.
- `vercel.json` — rewrites de `/api/*` a la función y del resto a `/index.html`.
- `.gitignore`, `.env.example` — variables actuales y futuras (comentadas, con su número de brief).
- `README.md` — qué es, cómo arrancar y cómo está organizado.
- `index.html` — `lang="es"`, título, meta description, favicons y Google Fonts con `preconnect`.
- `public/logo.png` — copia de `docs/referencia/logo.png`.
- `public/favicon.png` (32×32) y `public/apple-touch-icon.png` (180×180) — recorte cuadrado de la cabeza del logo.
- `src/main.tsx`, `src/App.tsx` — montaje con `BrowserRouter` y definición de rutas.
- `src/styles/tokens.css`, `src/styles/base.css` — tokens, `.contenedor`, reset, foco, `.fondo-oscuro`, reduced motion y `.placeholder`.
- `src/components/layout/Header.tsx` + `.css`, `Footer.tsx` + `.css`, `Layout.tsx`.
- `src/components/admin/AdminLayout.tsx` + `.css`.
- `src/pages/*.tsx` y `src/pages/admin/*.tsx` — placeholders.
- `src/lib/api.ts` — `apiGet<T>(path)`.
- `src/lib/formato.ts` — `pesos(n)`.
- `api/index.js` — reexporta la app.
- `server/app.js` — helmet, `express.json()`, rutas bajo `/api`, 404 JSON y errores.
- `server/dev.js` — `dotenv/config` + `app.listen(4000)`.
- `server/config/env.js` — `requerirEnv(nombre)`.
- `server/config/db.js` — `conectarDB()` y `estadoDB()`.
- `server/routes/health.js` — `GET /api/health`.
- `server/middlewares/errores.js` — `noEncontrado` y `manejarErrores`.
- `.gitkeep` en las carpetas vacías de la estructura: `src/components/{home,catalogo,producto,carrito,checkout,pago}`, `src/context`, `src/types`, `server/{lib,models,controllers,middlewares}` y `scripts/`.
- `docs/DEPLOY.md`, `docs/avances/01-setup.md`.

## Decisiones tomadas durante la implementación
- **Versiones instaladas:** React 19, react-router-dom 7, Vite 8, TypeScript 7, Express 5 y Mongoose 9 (las últimas al día de hoy). Express 5 cambia la sintaxis de comodines en rutas; por eso el 404 se monta con `app.use('/api', noEncontrado)` en vez de `app.get('/api/*')`.
- **Links de la nav del header como `/#productos`** (no `#productos` a secas): desde `/` solo cambian el hash, y desde otra página (por ejemplo `/checkout`) llevan al home en la sección. Con `#productos` a secas no harían nada fuera del home.
- **`react` y `react-dom`** se agregaron como dependencias (el brief solo nombraba `react-router-dom`). Los tipos (`@types/*`), `vite`, `@vitejs/plugin-react` y `typescript` van en devDependencies.
- **Favicon:** el logo es apaisado (706×388), así que se recortó la cabeza con la órbita a un cuadrado blanco, y se generaron dos tamaños. También se agregó `theme-color` amarillo.
- **Conexión a Mongo:** `bufferCommands: false` (en serverless conviene fallar rápido en vez de encolar) y `serverSelectionTimeoutMS: 8000`, para que un `/api/health` con la DB caída responda en segundos y no cuelgue la función. Si la conexión falla, se limpia la promesa cacheada para reintentar en el próximo request.
- **`/api/health` usa `estadoDB()`** para el campo `db` en la respuesta OK, así refleja el `readyState` real.
- **Errores fuera de producción:** el middleware agrega `stack` a la respuesta JSON solo si `VERCEL_ENV !== 'production'`. En producción responde solo `{ error }`.
- **`app.disable('x-powered-by')`:** helmet ya lo saca, pero queda explícito.
- **"Pedidos" activo también en `/admin/pedidos/:id`:** con `NavLink end` solo se marcaba en `/admin`, así que el estado activo de ese link se calcula a mano desde el `pathname`.
- **Clase `.placeholder` en `base.css`:** es un estilo compartido por todas las páginas provisorias. Se borra cuando las páginas tengan contenido real.
- **`AdminLogin` usa `<main>`** porque no tiene layout que lo provea.

## Desvíos respecto al brief
Ninguno.

## Pendientes / problemas encontrados
- **Repo de git:** la carpeta `mundo-mickey/` no tiene repo propio. Hoy queda dentro de un repo que abarca todo `C:\Users\Admin`. Para el deploy hay que hacer `git init` en `mundo-mickey/` y subirlo a un repo de GitHub nuevo (está como paso 0 en `DEPLOY.md`). No se hizo ningún commit.
- **`npm audit`:** reporta una vulnerabilidad crítica en `shell-quote`, que es dependencia de `concurrently` (solo dev). No afecta al build ni al deploy, porque `concurrently` solo se usa en `npm run dev` con comandos fijos. Bajar a `concurrently@9.2.1` cambia una advertencia por otra, así que quedó la última versión. Revisar cuando salga un parche.
- **Primer arranque de la API en local:** en Windows tardó unos 15 segundos en mostrar `API en http://localhost:4000`. Mientras tanto, Vite loguea `ECONNREFUSED` si se llama a `/api`. Los arranques siguientes son rápidos.
- **Datos del footer:** son placeholders. Salen de la configuración en el brief 07.
- **Rutas `/admin/<algo-inexistente>`:** caen en el NotFound de la tienda (con header y footer públicos). Se puede agregar un `*` dentro del panel cuando haya login (brief 06).

## Cómo probarlo
```bash
cd "Mundo Mickey/mundo-mickey"
npm install
cp .env.example .env        # completar MONGODB_URI (ver docs/DEPLOY.md)
npm run dev                 # logs [web] en amarillo y [api] en gris
```
- http://localhost:5173 → Inicio con header y footer.
- http://localhost:5173/api/health → `{ "ok": true, "db": "conectada", "entorno": "local" }`. Recargalo varias veces: `MongoDB conectada (...)` aparece una sola vez en el log `[api]`.
- Sin `MONGODB_URI` en `.env` → `500 { "ok": false, "db": "desconectada", "error": "Falta la variable de entorno MONGODB_URI" }`, y la API sigue viva.
- http://localhost:5173/api/nada → `404 { "error": "No existe GET /api/nada" }`.
- Rutas: `/producto/osito`, `/checkout`, `/pago/exito`, `/cualquier-cosa` (NotFound), `/admin`, `/admin/pedidos/123`, `/admin/productos`, `/admin/productos/nuevo`, `/admin/productos/abc`, `/admin/configuracion` y `/admin/login` (sin layout).
- DevTools a 375px: sin scroll horizontal, nav del header oculta y links del panel con scroll horizontal. A 1280px se ve la nav.
- Tab con el teclado: contorno negro en la tienda y amarillo en la barra del panel.
- `npm run build` → compila sin errores.

**Verificado en esta sesión:** build OK; `/api/health` sin URI (500, el proceso no se cae); con una URI inalcanzable (500 con el motivo, y reintenta en el siguiente request); con un MongoDB en memoria (3 llamadas, `ok: true`, un solo log de conexión); 404 JSON; headers de helmet; todas las rutas del front responden; capturas a 375px y 1280px de la tienda y del panel. **No se probó contra Atlas real**, porque no hay credenciales.
