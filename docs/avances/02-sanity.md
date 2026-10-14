# Avance 02 — Conexión con Sanity

## Qué se hizo
- **Proyecto de Sanity creado desde la CLI:** "Mundo Mickey", Project ID **`de0zicdv`**. Todo el paso 0 se hizo nuevo, porque no existía nada:
  - dataset `production` público;
  - CORS `http://localhost:5173` y `http://localhost:5174`, sin credentials;
  - token `mundo-mickey-api` con rol Editor.
- `.env` creado con las 5 variables de Sanity.
- Cliente de lectura en el front (con CDN) y `urlImagen()`. Tipos `Producto` y `Configuracion`, y queries tipadas.
- Clientes perezosos en la API (`sanityLectura` sin CDN y `sanityEscritura` con token). `/api/health` suma el campo `sanity`.
- `npm run seed`: sube las 6 ilustraciones SVG de la maqueta como assets y crea los 6 productos (`seed-*`) y la configuración.
- `npm run seed:limpiar`: borra los productos `seed-*` y sus imágenes, y no toca la configuración.
- Home temporal que lista los productos, con estados de cargando, error y lista vacía.

### Comandos del paso 0
Todos con `npx sanity@latest`, sin instalar `sanity` en el proyecto. Los corrí desde una carpeta vacía fuera del repo, para que ninguno pudiera dejar archivos de Studio. Antes de cada uno revisé el `--help`.
```bash
npx sanity@latest debug                     # sesión: logueado (santicbsn9@gmail.com)
npx sanity@latest projects list             # no había ningún "Mundo Mickey"
npx sanity@latest projects create "Mundo Mickey" --dataset=production --dataset-visibility=public --json
npx sanity@latest datasets list --project-id de0zicdv
npx sanity@latest cors list -p de0zicdv
npx sanity@latest cors add http://localhost:5173 --no-credentials -p de0zicdv
npx sanity@latest cors add http://localhost:5174 --no-credentials -p de0zicdv
npx sanity@latest tokens add mundo-mickey-api --role=editor --project-id de0zicdv --yes --json
#   └─ la salida va por pipe a un script que escribe SANITY_WRITE_TOKEN en .env, sin mostrarla
```
Para verificar la visibilidad del dataset, la organización del proyecto y el rol del token usé la Management API (`GET /v2021-06-07/projects/de0zicdv`, `/datasets`, `/cors`, `/tokens` y `/organizations`). Lo hice con el token de sesión de la CLI, leído en una variable del proceso: no se guardó ni se imprimió.

Verificación anónima: `GET https://de0zicdv.api.sanity.io/v2026-10-01/data/query/production?query=count(*)` → **200**.

## Archivos creados / modificados
- `src/lib/sanity.ts`: cliente de lectura y `urlImagen(fuente, ancho)`.
- `src/lib/queries.ts`: `obtenerProductos`, `obtenerProductoPorSlug` y `obtenerConfiguracion`.
- `src/types/producto.ts` (`Producto` e `ImagenSanity`) y `src/types/configuracion.ts`.
- `src/pages/Home.tsx`: lista temporal.
- `server/lib/sanity.js`: `sanityLectura()` y `sanityEscritura()`.
- `server/routes/health.js`: campo `sanity` y `errores.sanity`.
- `scripts/seed.js` y `scripts/limpiar-seed.js`.
- `package.json` / `package-lock.json`: `@sanity/client` 8.9 y `@sanity/image-url` 2.1; scripts `seed` y `seed:limpiar`.
- `.env.example`: variables de Sanity de la API activas y vacías.
- `docs/ARQUITECTURA.md`: solo la línea de `scripts/` en "Estructura de carpetas".
- `docs/DEPLOY.md`: sección "Sanity", variables de Sanity en la tabla de Vercel, `sanity` en la respuesta esperada de health y dos filas en "Problemas comunes".
- Borrados los `.gitkeep` de `scripts/`, `src/types/` y `server/lib/`, porque ya tienen archivos.
- `.env`: local, no versionado.

## Decisiones tomadas durante la implementación
- **`@sanity/image-url` 2.x** ya no tiene export default: se usa `createImageUrlBuilder`.
- **Clientes de la API como funciones** (`sanityLectura()`, `sanityEscritura()`) que crean el cliente en el primer llamado y lo cachean en el módulo. Si falta una variable, el error salta en el request que lo usa, y no al arrancar.
- **`/api/health`:** consulta Sanity en paralelo con la conexión a Mongo.
  - Mongo OK y Sanity mal → 200 con `ok: false` y `errores.sanity`.
  - Mongo mal → 500, como en el brief 01, y suma igual `sanity` (y `errores.sanity` si también falla).
- **Prefijo `seed-` con `string::startsWith`** y no con `match`. `match` en GROQ tokeniza por palabras: `"seed-*"` podría agarrar cualquier `_id` o nombre de archivo que contenga la palabra "seed".
- **Slugs generados desde `nombre`** (sin tildes, en minúsculas, con guiones), según ARQUITECTURA: `osito-de-peluche-gigante`, `dino-de-peluche`, etc. Ojo: `/producto/osito` (usado en las pruebas del brief 01) no va a matchear en el brief 04.
- **Las imágenes del seed no se duplican:** Sanity deduplica los assets por contenido, y subir el mismo SVG devuelve el mismo asset. Con eso y `createOrReplace`, correr el seed varias veces deja siempre 6 productos y 6 assets.
- **La configuración se crea en la misma transacción que los productos** (`createIfNotExists`). Antes se consulta si existía, solo para el resumen.
- **Placeholders de la configuración:** los mismos que el footer (`5493360000000`, `mundomickey`, "Dirección del local, San Nicolás de los Arroyos") y un horario de ejemplo.
- **`obtenerConfiguracion()` devuelve `Configuracion | null`**: el brief no lo decía, pero el documento puede no existir (por ejemplo, en un dataset nuevo).
- **El `.env` se escribió con un script propio** (en el scratchpad de la sesión, fuera del repo). Hace un upsert de las líneas: reemplaza la activa o la comentada, y si no existe la agrega al final.
- **`useCdn: true` en el front, como pide el brief.** La respuesta del API CDN trae `max-age=60, stale-while-revalidate=15` y varía por `Origin`. En una de las pruebas, un producto ocultado siguió visible en el navegador unos 20 segundos; en la repetición se ocultó al instante. **Un cambio desde el admin puede tardar hasta ~1 minuto en verse en la tienda.** Para el stock en el checkout no importa, porque la API lee sin CDN.

## Desvíos respecto al brief
- **El proyecto no quedó "sin organización".** La CLI no pidió elegir (no se pasó `--organization` ni `--yes`), pero lo asignó sola a la organización `santicbsn14` (`ooVuYuIDu`). Es la única organización de Santiago y tiene todos sus otros proyectos. Hoy Sanity no permite proyectos sueltos, así que no lo tomé como "la CLI obliga a elegir" y seguí. La organización tiene 6 miembros: **revisar si alguno no debería ver este proyecto**.
- **No existía `.env`** (el brief asumía uno con `MONGODB_URI`). Lo creé copiando `.env.example`, como dice el avance 01, así que **`MONGODB_URI` está vacía**. Hay que completarla (ver `docs/DEPLOY.md`).
- **`DEPLOY.md`:** además de la sección "Sanity", actualicé la tabla de variables de Vercel (decía "vacía por ahora (se completa en el brief 02)") y la respuesta esperada de health. Sin eso, el deploy quedaba sin las variables de Sanity.

## Pendientes / problemas encontrados
- **Completar `MONGODB_URI` en `.env`.** Sin eso, `/api/health` responde 500 por Mongo, aunque `sanity` dé `ok`. El caso "Mongo bien" lo probé con un MongoDB en memoria.
- **El puerto 5173 estaba ocupado por otro proyecto** (Plot Salud), y Vite levantó en el **5174**. Por eso los dos están en CORS.
- **CORS `http://localhost:3333` con credentials:** lo crea Sanity por defecto (es el puerto de Studio). No lo toqué, porque el brief pedía solo agregar. Como no se usa Studio, se puede borrar con `npx sanity@latest cors delete http://localhost:3333 -p de0zicdv`.
- **Bundle del front:** pasó a ~395 KB (123 KB gzip) por `@sanity/client`. Si molesta en el brief 03, se puede evaluar un fetch directo a la HTTP API para la lectura.
- **Las ilustraciones son SVG:** el CDN de imágenes las devuelve como SVG (`auto=format` no las convierte). Con las fotos reales (JPEG/WebP) sí va a aplicar el formato y la calidad.
- **`npm audit`:** sigue la advertencia de `shell-quote` (vía `concurrently`, solo dev) del brief 01.
- **`sanity.ts` tira el error al importarse** si faltan las `VITE_SANITY_*`, como pide el brief. Mientras el Home lo importe, sin esas variables la app entera muestra pantalla en blanco con el error en la consola.

## Cómo probarlo
```bash
cd "Mundo Mickey/mundo-mickey"
npm install
npm run seed            # 6 productos + "Configuración: ya existía, no se tocó."
npm run dev
```
- `http://localhost:5173` (o `:5174` si el 5173 está ocupado) → Inicio con los 6 productos, ilustración a 120px y precio `$34.900`, `$21.500`, etc.
- `/api/health` → `"sanity": "ok"`. Con `MONGODB_URI` vacía da 500 por la DB; con Mongo OK, `{ "ok": true, "db": "conectada", "sanity": "ok", ... }`.
- `SANITY_PROJECT_ID=noexiste0` en `.env` y reiniciar → 200 `{ "ok": false, "sanity": "error", "errores": { "sanity": "Dataset not found ..." } }`, y la API sigue viva.
- Query anónima: `https://de0zicdv.api.sanity.io/v2026-10-01/data/query/production?query=count(*[_type=="producto"])` → 6.
- `npm run seed:limpiar` → borra 6 productos y 6 imágenes, y la configuración queda. Después, `npm run seed` de nuevo.
- `npm run build` → compila.

**Verificado en esta sesión:**
- `seed` dos veces: siempre 6 productos, 6 assets y 1 configuración.
- `seed:limpiar`: deja 0 productos y 0 assets, y la configuración intacta. Después se volvió a correr el seed.
- Home con Chrome headless: 6 productos con imagen y precio.
- `activo: false` en `seed-robot`: desaparece del Home (con la demora de CDN explicada arriba) y quedó de nuevo en `true`.
- Health: Sanity OK, project ID inválido y variable faltante, los tres con Mongo en memoria y sin que se caiga el proceso.
- Build OK. Token: 0 apariciones en `src/`, en `dist/` y en los archivos versionables. En el bundle solo está el Project ID.
- No hay archivos de Studio, y `sanity` no está en `package.json`.
