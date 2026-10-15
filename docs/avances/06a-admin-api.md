# Avance 06a — Admin: login y API de productos

## Qué se hizo
- **Login del único admin:**
  - `POST /api/admin/login` compara el usuario y la contraseña (con `bcrypt.compare`) y devuelve `{ token, expira }`: un JWT HS256 de 12 horas con `sub` = usuario;
  - si falla el usuario o la contraseña, responde 401 con el mismo mensaje ("Usuario o contraseña incorrectos");
  - **límite de intentos** con `express-rate-limit`: 5 fallidos por IP cada 15 minutos (los exitosos no cuentan); el 6.º responde 429 con "Demasiados intentos. Probá de nuevo en unos minutos.";
  - `app.set('trust proxy', 1)` para tomar la IP real detrás del proxy de Vercel.
- **`requiereAdmin`** (`server/middlewares/auth.js`): lee `Authorization: Bearer <token>`. Sin token, inválido o vencido → 401 `{ error }`. Sin `JWT_SECRET` → 500 "Falta la variable de entorno JWT_SECRET", sin que se caiga la API.
- **`GET /api/admin/sesion`** → `{ usuario, expira }`.
- **API de productos**, toda con `requiereAdmin`:
  - listar (también los inactivos) y ver uno, con `sanityLectura()`, el slug aplanado y cada imagen como `{ _key, _ref, url }`;
  - crear y editar con validación (400 con `{ error, campos }` en castellano), slug único y fijo, `orden` al final, `_key` generado en el server y destacado único en la misma transacción;
  - reordenar (`PATCH /orden`) y eliminar (borra el producto y después intenta borrar sus imágenes).
- **API de imágenes:** `POST /api/admin/imagenes` con `multer` en memoria (un archivo en `imagen`, hasta 4 MB, solo JPEG, WebP y PNG) → `assets.upload` a Sanity → `{ _id, url }`.
- **Scripts:**
  - `npm run admin:hash`: pide la contraseña dos veces sin mostrarla e imprime el hash bcrypt (costo 12);
  - `npm run imagenes:limpiar`: lista las imágenes sin usar de más de 24 horas y pide confirmación (con `-- --si` no pregunta).
- **Credenciales de desarrollo** generadas en el `.env` local, sin imprimirlas:
  - `ADMIN_USER=admin`;
  - una contraseña aleatoria de 16 caracteres alfanuméricos. En el `.env` va su hash en `ADMIN_PASSWORD_HASH`, y la contraseña está **comentada en la línea de arriba** (`# Contraseña de desarrollo del admin: …`) para que Santiago la lea ahí;
  - `JWT_SECRET`: 48 bytes aleatorios en base64url.
- **Front:**
  - `AuthAdminContext`: sesión en `localStorage` (`mundo-mickey:admin`), validada con `/api/admin/sesion` al abrir el panel;
  - `api.ts`: `apiPost`, `apiPut`, `apiPatch`, `apiDelete` y `apiSubir`, con el token y con `ErrorApi` (mensaje, `status` y `campos`);
  - todo lo de `AdminLayout` exige sesión. Sin sesión, va a `/admin/login?volver=<ruta>`;
  - página de login, botón "Salir" y "Esta sección no existe" dentro del panel;
  - todo el panel se carga con `React.lazy`, en chunks aparte.
- `package.json`: script `dev:host`. `DEPLOY.md`: "Probar en el celular" lo usa.

## Archivos creados / modificados
- **Nuevos:**
  - API:
    - `server/middlewares/auth.js` y `server/middlewares/subida.js`;
    - `server/routes/admin.js`: todas las rutas de `/api/admin`. El login va antes del `router.use(requiereAdmin)`, y lo demás, después;
    - `server/controllers/adminSesion.js` (login y sesión), `adminProductos.js` y `adminImagenes.js`;
    - `server/lib/productos.js`: la proyección GROQ del panel, `slugificar`, `slugLibre` y `validarProducto`.
  - Scripts: `scripts/hash-password.js` y `scripts/limpiar-imagenes.js`.
  - Front:
    - `src/context/AuthAdminContext.tsx`;
    - `src/components/admin/AdminRaiz.tsx`: monta el `AuthAdminProvider` para todo `/admin` (ver "Desvíos");
    - `src/components/admin/CargandoPanel.tsx`: el "Cargando…";
    - `src/pages/admin/AdminNoEncontrada.tsx` y `src/pages/admin/AdminLogin.css`.
  - `docs/avances/06a-admin-api.md`.
- **Modificados:**
  - `package.json` / `package-lock.json`: `jsonwebtoken` 9.0, `bcryptjs` 3.0, `multer` 2.4 y `express-rate-limit` 8.7; scripts `dev:host`, `admin:hash` e `imagenes:limpiar`;
  - `server/app.js`: `trust proxy` y `app.use('/api/admin', admin)`;
  - `src/lib/api.ts`, `src/App.tsx`, `src/components/admin/AdminLayout.tsx` + `.css` y `src/pages/admin/AdminLogin.tsx`;
  - `.env.example`, `docs/DEPLOY.md` y `docs/ARQUITECTURA.md` (solo lo indicado: 3 endpoints, 3 decisiones y los scripts en la estructura);
  - `.env`: local, no se commitea.
- **Borrados:** los `.gitkeep` de `server/controllers/` y `server/middlewares/`.

## Decisiones tomadas durante la implementación
- **El hash va sin comillas en el `.env`.** `dotenv` no expande los `$`: lo verifiqué con un script que lee el `.env` con `dotenv.parse` y compara la contraseña comentada con `bcrypt.compare` (hash de 60 caracteres, `true`). El login real contra la API también entra.
- **Login sin pistas de tiempo:** con un usuario incorrecto también se corre bcrypt, contra un hash de relleno, así la respuesta tarda lo mismo. El hash de relleno se calcula en el primer login y no al importar, para no sumarle unos 250 ms a cada arranque en frío.
- **El token tiene que ser del `ADMIN_USER` actual:** si cambia el usuario, los tokens viejos dejan de servir.
- **`requiereAdmin` cubre todo `/api/admin` menos el login**, también las rutas que no existen: `/api/admin/lo-que-sea` sin token da 401, no 404. Así no se puede averiguar qué endpoints hay.
- **Validación:**
  - `precio` y `stock` tienen que ser números enteros en el JSON. `"3"` (texto) o `10.5` dan 400;
  - `destacado` y `activo` son obligatorios. Con un `PUT` es más seguro: si faltara `activo` y se tomara `true` por defecto, se podría mostrar sin querer un producto oculto;
  - los ids de imagen tienen que tener el formato de Sanity (`image-<hash>-<ancho>x<alto>-<formato>`), sin repetidos; después se verifica con una query que existan todos;
  - `nombre`, `descripcion` y `badge` se guardan sin espacios al principio ni al final. Un `badge` vacío lo quita del documento (`unset`).
- **Slug:** se arma igual que el seed. Si el nombre no deja nada (por ejemplo, "¡¡!!"), queda `producto`. Los ocupados se buscan con `slug.current == base || string::startsWith(slug.current, "base-")`, y se toma el primer libre.
- **Ids de producto nuevos:** UUID. Los del seed siguen siendo `seed-*`.
- **`PUT` conserva el `_key`** de las imágenes que ya estaban, y genera uno nuevo para las nuevas. Así React no remonta las miniaturas en el 06b.
- **`PATCH /orden` responde con la lista ya ordenada**, para que el panel no tenga que pedirla de nuevo.
- **Imágenes:**
  - además del `Content-Type` del cliente, se miran los primeros bytes del archivo (JPEG, PNG o WebP). Un `.txt` mandado como `image/jpeg` da 400 y no llega a Sanity;
  - el `filename` usa la extensión del tipo real.
  - Responde 201 (se creó un asset).
- **`DELETE`:** se borra el producto y después cada imagen por separado. Si Sanity no deja borrar una porque otro documento la usa, se registra en el log y se sigue. Lo probé con una foto compartida entre dos productos de prueba.
- **Front — sesión:**
  - si el token guardado ya venció, ni se valida contra la API: se borra;
  - si al validar la API responde 401, se borra. Si no responde (red o 500), se confía en el vencimiento guardado, y cualquier pedido posterior lo vuelve a validar;
  - un timer cierra la sesión al llegar al vencimiento.
- **Front — `api.ts`:**
  - **el token se manda solo a `/api/admin/*`**, no a los endpoints públicos (checkout, estado del pedido);
  - el token y "qué hacer con un 401" los registra `AuthAdminContext` con `configurarSesionAdmin()`. Así el contexto no viaja en el chunk de la tienda;
  - un 401 de `/api/admin/*` (menos el login) llama a `logout()`, y la protección de rutas de `AdminLayout` lleva a `/admin/login?volver=<ruta actual>`. La redirección queda en un solo lugar;
  - sin conexión, `ErrorApi` con `status` 0 y "No se pudo conectar con el servidor…".
- **`volver`:** se acepta solo si es `/admin`, `/admin/…`, `/admin?…` o `/admin#…`, y no el login. Cualquier otra cosa (`https://…`, `//…`) lleva a `/admin`. En la URL las `/` van sin codificar (`?volver=/admin/productos`), para que se lea.
- **"Salir"** lleva a `/admin/login` sin `volver`.
- **Login:**
  - el error va en un recuadro amarillo con borde negro, con `role="alert"`;
  - "Mostrar"/"Ocultar" usa `aria-pressed` y `aria-controls`;
  - inputs de 48px de alto con letra de 16px (iOS no hace zoom), con `autocomplete` `username` / `current-password`;
  - fondo amarillo y la caja blanca centrada, como la marca.
- **Barra del panel:** "Salir" va al final, en un estilo más suave que las secciones. En el celular queda arriba a la derecha, al lado del título, y las secciones bajan a su propia fila.

## Desvíos respecto al brief
- **Archivos nuevos que no estaban listados:**
  - `AdminRaiz.tsx`: el `AuthAdminProvider` tiene que envolver al login y al `AdminLayout` juntos, para que compartan la sesión. Como componente lazy, el contexto queda fuera del chunk de la tienda;
  - `CargandoPanel.tsx`: el "Cargando…" que usan el `Suspense` de `App.tsx`, `AdminRaiz` y `AdminLayout`. Tiene estilos en línea, porque se muestra antes de que llegue el CSS del panel. Es lo único "del panel" que queda en el chunk de la tienda (8 líneas);
  - `AdminNoEncontrada.tsx`: el `*` del panel;
  - `server/lib/productos.js`: la validación y el slug, fuera del controller.
- **Arreglo en `AdminLayout`:** el `NavLink` de "Pedidos" (`/admin`) no tenía `end`, así que en `/admin/productos` y `/admin/configuracion` se marcaban **dos** secciones activas. Venía de antes y lo vi en las capturas. Le agregué `end`.
- **El JS de la tienda creció 1,68 kB** (1 kB gzip, un 0,4 %): no quedó exactamente igual. No es código del panel: busqué `ErrorApi`, `mundo-mickey:admin` y los textos del login en el chunk, y hay 0 apariciones. Son dos cosas de Vite al tener `import()` dinámicos:
  - el helper de precarga de módulos;
  - el runtime de JSX, que pasa a un chunk compartido (`jsx-runtime-*.js`, 0,96 kB) porque lo usan la tienda y el panel. `index.html` lo precarga.

  Se suma `CargandoPanel`. A cambio, salieron de la tienda los placeholders del panel y su CSS.

  | | Antes | Después |
  |---|---|---|
  | JS de la tienda | `index-*.js` 420,65 kB (130,19 gzip) | `index-*.js` 421,37 kB (130,70 gzip) + `jsx-runtime-*.js` 0,96 kB (0,55 gzip) |
  | CSS de la tienda (`index-*.css`) | 22,42 kB (5,12 gzip) | 21,45 kB (4,97 gzip) |
  | Panel (solo se carga en `/admin`) | — | 7,9 kB de JS en 10 chunks y 3,1 kB de CSS en 2 |

  Si se quiere bajar, `build.modulePreload.polyfill: false` en `vite.config.ts` ahorra el polyfill de precarga (los navegadores actuales no lo necesitan). No lo toqué porque el brief no incluía la config de Vite.
- **`hash-password.js` también acepta la contraseña por pipe** (sin terminal), para poder probarlo con un script. En una terminal no muestra nada al tipear. También pide **al menos 12 caracteres** y rechaza espacios al principio o al final.

## Pendientes / problemas encontrados
- **Las fotos de pedidos viejos se rompen al borrar un producto.** El pedido guarda `imagenUrl`, pero `DELETE` borra el asset de Sanity, y esa URL pasa a dar 404. Nombre y precio quedan bien. Para el brief 08 o el 10, hay dos opciones: no borrar los assets en el `DELETE` (y que los limpie `imagenes:limpiar`, aunque tampoco sabe de los pedidos de Mongo) o mostrar un placeholder en el panel cuando la imagen no carga. **A definir.**
- **El límite de intentos es por instancia.** En Vercel cada instancia tiene su propio contador en memoria, y un arranque en frío lo reinicia. Es una protección parcial; con la contraseña larga y bcrypt alcanza para este caso.
- **`PUT` no borra las fotos que se sacaron del producto.** Quedan como assets sin usar, y `npm run imagenes:limpiar` las borra pasadas 24 horas. Lo mismo con las fotos que se suben y nunca se guardan.
- **Token adulterado y consola:** el panel lleva al login sin errores de JavaScript. Chrome igual muestra en la consola el aviso de red `Failed to load resource: … 401` de `/api/admin/sesion` (dos veces en desarrollo, por el `StrictMode`). Es el log del navegador para cualquier respuesta 4xx: no se puede evitar desde el código sin que el endpoint deje de responder 401.
- **`admin:hash` en una terminal real:** lo probé por pipe (hash correcto, contraseña corta y contraseñas distintas). El modo sin eco usa `setRawMode`, y no lo pude probar a mano. Santiago: corrélo una vez en la terminal de VS Code o en PowerShell. En Git Bash (mintty) puede hacer falta `winpty npm run admin:hash`.
- **Había un `npm run dev` de Mundo Mickey ya corriendo** (Vite en el 5173 y la API en el 4000 con `node --watch`), de antes de esta sesión. Las pruebas de la API las hice contra una instancia propia en el 4100. Las del navegador, con un Vite propio en el 5174, que usa la API del 4000 por el proxy. La prueba de "demasiados intentos" bloqueó `localhost` en esa API, y la reinicié tocando `server/app.js` (el `--watch` la reinicia y el contador vuelve a 0). Si alguna vez queda bloqueado en desarrollo, se libera a los 15 minutos o reiniciando la API.
- **`npm audit`:** siguen las 2 advertencias críticas de `shell-quote` (vía `concurrently`, solo dev), las mismas de antes. Las dependencias nuevas no suman ninguna.
- **Errores 400 de JSON mal formado:** `manejarErrores` responde bien (400), pero imprime el stack completo en el log. Si molesta, se puede loguear solo los 5xx.

## Cómo probarlo
```bash
cd "Mundo Mickey/mundo-mickey"
npm install
npm run dev            # o npm run dev:host para el celular
```
La contraseña de desarrollo está comentada en el `.env` local, arriba de `ADMIN_PASSWORD_HASH`.

**En el navegador:**
- `/admin/productos` sin sesión → `/admin/login?volver=/admin/productos`. Probá una contraseña incorrecta y después la correcta → vuelve a `/admin/productos`. Recargá: la sesión sigue.
- `/admin/cualquier-cosa` → "Esta sección no existe", con la barra del panel.
- "Salir" → `/admin/login`.
- Token adulterado: en DevTools → Application → Local Storage, cambiá letras del `token` en `mundo-mickey:admin` y recargá → login.

**API con `curl`** (en Git Bash; en PowerShell usá `curl.exe` y cambiá las comillas):
```bash
API=http://localhost:4000/api

# Sin token → 401
curl -i $API/admin/productos

# Login (poné la contraseña de desarrollo del .env)
TOKEN=$(curl -s -X POST $API/admin/login -H "Content-Type: application/json" \
  -d '{"usuario":"admin","password":"<contraseña>"}' | node -pe "JSON.parse(require('fs').readFileSync(0)).token")
AUTH="Authorization: Bearer $TOKEN"

curl -s $API/admin/sesion -H "$AUTH"
curl -s $API/admin/productos -H "$AUTH"
curl -s $API/admin/productos/seed-robot -H "$AUTH"

# Subir una foto → { _id, url }
curl -s -X POST $API/admin/imagenes -H "$AUTH" -F "imagen=@foto.jpg;type=image/jpeg"
curl -s -X POST $API/admin/imagenes -H "$AUTH" -F "imagen=@nota.txt;type=text/plain"   # → 400

# Crear (con el _id de la foto)
curl -s -X POST $API/admin/productos -H "$AUTH" -H "Content-Type: application/json" \
  -d '{"nombre":"Peluche de prueba","descripcion":"","precio":12345,"stock":3,"imagenes":["image-…-jpg"],"badge":"","destacado":false,"activo":true}'

# Editar, reordenar y borrar
curl -s -X PUT $API/admin/productos/<id> -H "$AUTH" -H "Content-Type: application/json" -d '{ …mismos campos… }'
curl -s -X PATCH $API/admin/productos/orden -H "$AUTH" -H "Content-Type: application/json" -d '{"ids":["…","…"]}'
curl -i -X DELETE $API/admin/productos/<id> -H "$AUTH"

# Al terminar
npm run seed
npm run imagenes:limpiar
```

**Verificado en esta sesión:**

*API* (script con `fetch` contra una instancia propia de la API, 64 chequeos, todos OK):
- **Sin token:** los 8 endpoints, y una ruta inexistente de `/api/admin`, dan 401.
- **Tokens inválidos:** vencido ("La sesión venció…"), firmado con otro secreto, de otro usuario y basura → 401.
- **Sin `JWT_SECRET`:** `/sesion` y `/login` → 500 "Falta la variable de entorno JWT_SECRET".
- **Login:**
  - usuario incorrecto y contraseña incorrecta → 401 con el mismo mensaje;
  - el correcto → token HS256, `sub` = `admin`, vence en 12,00 h;
  - `/sesion` devuelve el mismo `expira`.
- **Límite:** con 2 fallidos y un exitoso antes, los fallidos 3.º a 5.º dan 401 y el 6.º da 429. Después, ni la contraseña correcta entra (429).
- **Listado:**
  - los 6 del seed, con las imágenes como `{ _key, _ref, url }`;
  - con el robot en `activo: false` (por `PUT`), sigue en el listado;
  - `GET /:id` OK y uno inexistente → 404.
- **Imágenes:**
  - un JPEG → 201 `{ _id, url }`, guardado como `producto-<timestamp>.jpg`;
  - 400 con mensaje para: 5 MB ("La imagen pesa más de 4 MB."), `.txt` ("Solo se aceptan imágenes JPG, WebP o PNG."), `.txt` disfrazado de `image/jpeg`, otro nombre de campo y sin archivo.
- **Crear:**
  - 201 con slug `peluche-de-prueba-06a` y `orden` 7. Ignora `slug`, `orden`, `_id` y un campo extra;
  - con `destacado: true` queda un solo destacado, el nuevo;
  - mismo nombre → `peluche-de-prueba-06a-2`, `orden` 8;
  - inválidos → 400 con los 8 `campos` en castellano. También dan 400 el cuerpo vacío, un precio decimal, el stock como texto, 9 imágenes y un id de imagen inexistente; y el JSON mal formado.
- **Editar:**
  - cambiar el nombre no cambia ni el slug ni el `orden`;
  - el badge vacío se quita y se conserva el `_key` de la imagen;
  - con `destacado: true` en el otro → un solo destacado;
  - las imágenes quedan en el orden recibido;
  - inexistente → 404 e inválido → 400.
- **Orden:** invertido OK, con `orden` 1 a 8; con un faltante, un repetido o uno que no existe → 400.
- **Tienda:** el producto creado apareció en la query de la tienda contra el API CDN (activo, por slug) al primer intento.
- **Borrar:**
  - los dos productos → 204, y los dos assets ya no existen;
  - el primer `DELETE` no pudo borrar la foto compartida y siguió; el segundo la borró;
  - borrar de nuevo → 404.
- **Restaurado** con `npm run seed`: 6 productos, 6 imágenes y la configuración intacta.

*Navegador* (Chrome headless por CDP, Vite en el 5174):
- **Tienda:** en `/` no se pide ningún módulo del panel (solo `CargandoPanel`).
- **Login:**
  - sin sesión, `/admin/productos` → `/admin/login?volver=/admin/productos`;
  - "Mostrar"/"Ocultar" funciona;
  - con una contraseña incorrecta, el botón se deshabilita mientras envía y aparece la alerta;
  - con la correcta → `/admin/productos`, con la sesión guardada (vence en 12 h) y solo "Productos" activo;
  - recargar mantiene la sesión.
- **Panel:**
  - `/admin/cualquier-cosa` → "Esta sección no existe" con link a `/admin`;
  - ya logueado, `/admin/login` → `/admin`, y `?volver=https://ejemplo.com` → `/admin`;
  - "Salir" → `/admin/login` y la sesión borrada;
  - `?volver=//ejemplo.com/admin` → `/admin`.
- **Sesiones inválidas:**
  - token adulterado → login con `volver` y la sesión borrada, sin errores de JS (solo el aviso de red del 401);
  - token vencido → login, sin pedir `/sesion` y sin nada en la consola;
  - `localStorage` corrupto → login sin errores.
- **Demasiados intentos:** después de los fallidos, aparece "Demasiados intentos. Probá de nuevo en unos minutos.".

*Scripts:*
- `admin:hash` por pipe: hash de 60 caracteres, "al menos 12 caracteres" y "no coinciden".
- `imagenes:limpiar`, con una foto huérfana recién subida: **encontró 0 de 7** (la nueva no aparece por la regla de 24 horas) y dijo "No hay nada para borrar.".
  - Con una copia temporal del script en 0 horas, la listó y pidió confirmación: con "n" no borró nada, y con `--si` la borró.
  - La foto de prueba quedó borrada.

*Build y seguridad:*
- `npm run build` sin errores.
- La contraseña de desarrollo, su hash, `JWT_SECRET` y `SANITY_WRITE_TOKEN`: 0 apariciones en `src/`, en `dist/`, en los archivos versionados y en este avance.

**Capturas** (fuera del repo), en `C:\Users\Admin\Proyectos\Mundo Mickey\capturas\06a-admin-api\`:
- `login-1280.png` y `login-375.png`;
- `login-error-375.png` y `login-demasiados-intentos-375.png`;
- `panel-1280.png` y `panel-375.png`: barra con "Salir";
- `seccion-inexistente-375.png`.
