# Avance 08 — Checkout y preferencia de Mercado Pago

## Qué se hizo
- **Paso 0 — puesta al día:**
  - **Mongo:** `/api/health` → `{ ok: true, db: "conectada", sanity: "ok" }` contra **`mundo-mickey-dev`** del cluster `mundo-mickey` del dueño, con la cadena estándar `mongodb://` de tres hosts que ya estaba en el `.env`. La base estaba vacía (sin colecciones).
  - **`DEPLOY.md`:** la sección "1. MongoDB Atlas" se reescribió: el cluster del dueño, `mundo-mickey-dev` en local y `mundo-mickey` en Vercel (mismo cluster y usuario), acceso `0.0.0.0/0`, las dos formas de la connection string (`+srv` para Vercel y la estándar de "Version 2.2.12 or later" para la PC de Santiago) y cómo probar. Sin credenciales. Ya no dice "provisorio" ni "compartido". En "Problemas comunes", la fila de `querySrv ECONNREFUSED`.
  - **`ARQUITECTURA.md`:** la línea de MongoDB nombra el cluster del dueño y las dos bases.
  - **"Gratis":** nueva función `costoEnvio(n)` en `src/lib/formato.ts` (0 → "Gratis", si no `pesos(n)`). La usan `EntregaProducto` y el checkout.
  - **Panel:** la textarea del envío nacional con `resize: vertical` explícito en `FormConfiguracion.css` (ver "Desvíos").
- **Variables:** `MP_ACCESS_TOKEN` y `SITE_URL` en `.env.example` (con la Public Key comentada como "no se usa") y en la tabla de Vercel de `DEPLOY.md`, con la aclaración de que en producción va el token de producción de la cuenta real del dueño y el dominio final. El `.env` ya tenía `SITE_URL=http://localhost:5173`; **`MP_ACCESS_TOKEN` no estaba** (sigue comentado), así que los criterios que dependen de Mercado Pago quedan pendientes.
- **Dependencia:** `mercadopago` ^3.6.1 (ver "Desvíos").
- **Modelos** (`server/models/`):
  - `Counter.js` con `siguienteNumero('pedido')`: `findOneAndUpdate` con `$inc`, `upsert` y `returnDocument: 'after'`;
  - `Pedido.js` con todos los campos del brief, `timestamps`, `numero` único, índices por `estado` y `createdAt`, y `stockDescontado: false` por defecto. Exporta `ESTADOS` y `TIPOS_ENTREGA`.
- **Mercado Pago** (`server/lib/mercadopago.js`): cliente `Preference` perezoso con `requerirEnv('MP_ACCESS_TOKEN')` y timeout de 10 s; `cuerpoPreferencia(pedido)` y `crearPreferencia(pedido)` → `{ id, init_point }`.
- **API `POST /api/pagos/checkout`** (`server/routes/pagos.js`, `server/controllers/pagos.js` y la validación en `server/lib/checkout.js`):
  - límite de 10 por IP cada 10 minutos (429 con el mensaje del brief);
  - lee la configuración y los productos pedidos **sin CDN**, en paralelo;
  - valida todo con 400 `{ error: "Revisá los datos del pedido.", campos }` y las claves anidadas del brief;
  - 409 `{ error: "Algunos productos cambiaron.", items: [{ id, motivo, stockDisponible }] }` sin crear nada;
  - 500 "Falta configurar Mercado Pago." si no hay token, antes de crear el pedido;
  - número del `Counter`, pedido en `pendiente_pago` con su historial, preferencia, `mp.preferenciaId` y 201 `{ pedidoId, numero, initPoint }`;
  - si Mercado Pago falla: pedido `cancelado` (historial + motivo en `mp.detalle`) y 502.
- **Front `/checkout`** (`src/pages/Checkout.tsx` + `.css`, `src/components/checkout/FormCheckout` y `ResumenCheckout`, cada uno con su CSS):
  - carrito vacío: "Tu carrito está vacío" y "Ver productos" a `/#productos`;
  - una columna en el celular, con el resumen arriba, cerrado y mostrando "N productos · $total"; desde 900px, formulario a la izquierda y resumen `sticky` a la derecha;
  - resumen con miniaturas, "cantidad × precio", subtotal, envío ("Gratis", el costo o "A coordinar"), total y "Editar carrito" (abre el drawer);
  - formulario en tres bloques numerados (Tus datos, Entrega y Pago), con todo lo del brief;
  - al pagar: validación de vacíos, botón deshabilitado con "Te estamos llevando a Mercado Pago…", y el manejo de 201 / 400 / 409 / 429 / 502 / sin conexión del brief;
  - lo escrito queda en `sessionStorage` (`mundo-mickey:checkout`); el último pedido, en `mundo-mickey:ultimo-pedido`;
  - `document.title` "Finalizar compra · Mundo Mickey".
- **Carrito después de un 409:** `ajustarStock(problemas)` en `CarritoContext` y `recargarProductos()` en `useProductos`.
- **`npm run imagenes:limpiar`:** conecta a Mongo, pasa cada `items.imagenUrl` de los pedidos a id de asset y no los lista ni los borra. Sin Mongo, no borra nada, lo dice y sale con código 1.
- **`ARQUITECTURA.md`:** en "Flujo de pago", el 409, el 502 con el pedido cancelado, `notification_url` solo con https y el carrito que se vacía al confirmar el pago; en "Decisiones tomadas", las dos del brief.

## Archivos creados / modificados
- **Nuevos:**
  - `server/models/Pedido.js` y `Counter.js`;
  - `server/lib/mercadopago.js` y `server/lib/checkout.js` (validación, stock y montos);
  - `server/routes/pagos.js` y `server/controllers/pagos.js`;
  - `src/pages/Checkout.css`;
  - `src/components/checkout/FormCheckout.tsx`/`.css` y `ResumenCheckout.tsx`/`.css`;
  - `src/lib/provincias.ts`;
  - `docs/avances/08-checkout.md`.
- **Modificados:**
  - `package.json` y `package-lock.json` (`mercadopago`);
  - `server/app.js` (`/api/pagos`);
  - `src/pages/Checkout.tsx` (reemplaza el placeholder);
  - `src/components/producto/EntregaProducto.tsx` ("Gratis");
  - `src/components/admin/FormConfiguracion.css` (`resize: vertical`);
  - `src/context/CarritoContext.tsx` (`ajustarStock`) y `src/hooks/useProductos.ts` (`recargarProductos`);
  - `src/lib/api.ts` y `src/lib/formato.ts` (ver "Desvíos");
  - `scripts/limpiar-imagenes.js`;
  - `.env.example`, `docs/DEPLOY.md` y `docs/ARQUITECTURA.md` (solo lo indicado).
- `.env`: no hizo falta tocarlo (`SITE_URL` ya estaba).

## Decisiones tomadas durante la implementación
- **Orden de las validaciones:** primero se leen configuración y productos (hacen falta para saber si un envío está habilitado), después 400, después 409 y recién después el 500 por falta de token. Así un pedido inválido recibe su error real aunque no esté configurado Mercado Pago, y nada se crea si falla cualquiera de los tres.
- **El límite de pedidos cuenta todos los intentos** (también los 400 y 409), como pide el brief: 10 por IP. Con la validación de vacíos del front, un comprador real no llega. Como el del login, vive en la memoria de cada instancia.
- **Errores de `items`** van en una sola clave `items` (no hay un campo para cada línea en pantalla): carrito vacío, más de 20 líneas, línea inválida o id repetido. El front los muestra en el recuadro de error.
- **Validación:**
  - nombre, apellido, calle y localidad: de 2 a su máximo; número: 1 a 10;
  - celular: se aceptan espacios, guiones y paréntesis entre los 10 dígitos;
  - provincia: tiene que ser una de las 24 de la lista (la misma en `server/lib/checkout.js` y `src/lib/provincias.ts`);
  - código postal: se guarda sin espacios y en mayúsculas (`b2900abc` → `B2900ABC`);
  - todos los textos, sin espacios al principio ni al final.
- **`imagenUrl`** es `imagenes[0].asset->url` (la portada), que ya es la URL base sin parámetros. La `picture_url` de la preferencia le suma `?w=400&h=400&fit=max&fm=jpg&q=80`: en JPEG porque las fotos del seed son SVG (comprobé que el CDN de Sanity devuelve `image/jpeg`).
- **`payer.identification`** va como `{ type: "DNI", number }`: el SDK lo tipa sin problemas.
- **`auto_return` con localhost:** no lo pude probar (sin token). `crearPreferencia` lo manda siempre; si `SITE_URL` no es https y Mercado Pago lo rechaza mencionando `auto_return` o `back_url`, vuelve a crear la preferencia sin él (y lo avisa en la consola). Con https no hay reintento.
- **Si falla guardar `mp.preferenciaId`** (después de crear la preferencia), el error llega al manejador general (500). Es un caso muy raro y el webhook del 09 puede encontrar el pedido por `external_reference`.
- **Tipo de entrega en el front:** por defecto, retiro. Si lo guardado en `sessionStorage` ya no está habilitado, se usa retiro (pero recién cuando terminó de cargar la configuración, para no pisarlo mientras carga). Si la configuración no carga, solo aparece el retiro.
- **El 409 en el carrito:** `ajustarStock` aplica primero lo que respondió la API (que leyó sin CDN): quita los `no_disponible` y los de stock 0, y acota los demás. Después llama a `recargarProductos()` (descarta la promesa compartida y vuelve a pedir) y sincroniza. Como `sincronizar` solo quita o acota, un CDN atrasado no devuelve lo quitado, y el `stock` de cada ítem queda en el menor de los dos.
- **Ítems marcados:** "Quedan N" en los que siguen en el carrito y, para los que se quitaron, una fila tachada con "Sin stock", así se entiende qué pasó. Si el carrito queda vacío, se muestra la vista vacía con el aviso arriba. El resumen se abre solo en el celular y el foco va al aviso.
- **Volver desde Mercado Pago con "atrás":** si el navegador restaura la página desde el bfcache, el botón seguiría deshabilitado; un `pageshow` con `persisted` lo vuelve a habilitar. Al recargar, el formulario sale de `sessionStorage`.
- **Celular:** misma regla que el WhatsApp del panel (si pegan `+54 9 0336 412-3456`, al salir del campo queda `3364123456`), con el prefijo "+54 9" `aria-hidden` y el texto ", después del +54 9" solo para lectores de pantalla.
- **Tarjetas de entrega:** el `input` radio queda adentro del `label` con opacidad 0, como en la maqueta, así se navegan con las flechas; el foco visible está en la tarjeta (`:has(input:focus-visible)`). Una dirección o un horario con saltos de línea se respetan (`pre-line`).
- **Piezas de formulario propias (`ck-*`):** las del panel viven en `AdminLayout.css`, que la tienda no carga. Los inputs llevan borde negro de 2px (más marca que en el panel), 48px de alto y 16px de letra.
- **Con envío nacional,** debajo del total del bloque "Pago" dice "El envío no está incluido: lo coordinamos por WhatsApp.".

## Desvíos respecto al brief
- **SDK `mercadopago` 3.6.1 y no 2.x:** es la versión actual en npm y mantiene la misma API (`MercadoPagoConfig` y `Preference`).
- **`returnDocument: 'after'` en lugar de `new: true`** en `siguienteNumero`: Mongoose 9 marca `new` como deprecado (aparecía un warning en cada pedido). Hace lo mismo.
- **`resize: vertical` ya funcionaba:** la textarea tenía `.campo__textarea { resize: vertical }` desde `AdminLayout.css`. Lo dejé explícito en `.fc__textarea-corto` igual, como pide el brief.
- **`src/lib/api.ts` (archivo no listado):** `ErrorApi` ahora guarda el cuerpo completo de la respuesta en `datos`, porque el 409 trae `items` además de `error`. No cambia nada para quien ya lo usaba.
- **`src/lib/formato.ts` (no listado):** `costoEnvio()`, para usar el mismo criterio de "Gratis" en el detalle y en el checkout.
- **`src/lib/provincias.ts` (nuevo, no listado):** la lista de provincias del front.
- **`DEPLOY.md`:** además de lo pedido, en "3. Verificar" el texto de `/checkout` pasó de "Checkout" a "Finalizar compra (o Tu carrito está vacío)", que es lo que se ve ahora.

## Pendientes / problemas encontrados
- **Todo lo que necesita `MP_ACCESS_TOKEN` queda pendiente**, porque no estaba en el `.env`:
  - el 201 con `pedidoId`, `numero` e `initPoint`, el pedido con `mp.preferenciaId` y la preferencia consultada en la API de Mercado Pago;
  - qué devuelve Mercado Pago en `init_point` con la cuenta de prueba vendedor, y si acepta `auto_return` con las URLs de localhost;
  - el `initPoint` abriendo el checkout con el total correcto, y volver con "atrás" con el carrito y el formulario.

  Para probarlo: poner el token en el `.env` (`MP_ACCESS_TOKEN=APP_USR-…`, sin comillas) y seguir "Con Mercado Pago" en "Cómo probarlo". Hay un ejemplo del cuerpo que se manda más abajo.
- **El 502 sí está probado,** con un token inválido: Mercado Pago respondió `invalid access token`, el pedido quedó `cancelado` y la API respondió 502.
- **El límite de pedidos es por instancia** (memoria): en Vercel, con varias instancias, un script podría pasar algo más de 10. Para este volumen alcanza.
- **El header `sticky` aparece en el medio de las capturas de página completa**: es un efecto de la captura, no de la página.
- **El JS de la tienda pasó de 426,12 kB a 434,43 kB** (+8,3 kB, 134 kB gzip), por el checkout. Se podría cargar `/checkout` con `lazy` si hiciera falta. **A definir.**

## Cómo probarlo
```bash
cd "Mundo Mickey/mundo-mickey"
npm run dev          # Vite en 5173 (o 5174) y la API en 4000
```
Sumá algo al carrito y tocá "Continuar compra".

- **Vacío:** con el carrito vacío, `/checkout` muestra "Tu carrito está vacío" y "Ver productos".
- **Entrega:** elegí cada opción. Con San Nicolás aparecen calle, número, piso/depto y código postal y el resumen suma el costo; con todo el país, además localidad y provincia, y el envío dice "A coordinar".
- **Errores:** "Pagar" con todo vacío → errores debajo de cada campo y el foco en "Nombre". Con DNI `123` y email `ana@ejemplo` → los errores de la API debajo de esos campos.
- **Recargar:** lo escrito sigue ahí.
- **409:** con el robot ×2 en el carrito, bajale el stock a 1 por script y tocá "Pagar" → aviso arriba del resumen, robot ×1 con "Quedan 1". Restaurá el stock.
- **Sin token:** "Pagar" con todo bien → "Falta configurar Mercado Pago." y el botón vuelve a habilitarse.

**Con Mercado Pago** (cuando esté el token): "Pagar" → redirige a Mercado Pago; volver con "atrás" mantiene carrito y formulario. Para ver la preferencia (Git Bash, sin imprimir el token):
```bash
curl -s https://api.mercadopago.com/checkout/preferences/<preferenciaId> \
  -H "Authorization: Bearer $(grep ^MP_ACCESS_TOKEN= .env | cut -d= -f2)"
```
**Al terminar las pruebas,** borrá los pedidos de `mundo-mickey-dev` y el contador (`counters`, `_id: "pedido"`), así el próximo pedido arranca en #0001.

**API con `curl`** (Git Bash; en PowerShell usá `curl.exe`):
```bash
API=http://localhost:4000/api/pagos/checkout
CLIENTE='"cliente":{"nombre":"Ana","apellido":"Pérez","dni":"30.123.456","celular":"3364123456","email":"ana@ejemplo.com"}'

# 400 con cada error en su clave
curl -s -X POST $API -H "Content-Type: application/json" -d '{"items":[{"id":"seed-dino","cantidad":1.5}],"cliente":{"nombre":"A","dni":"12"},"entrega":{"tipo":"avion"}}'
# 400 en los campos de dirección (envío sin dirección)
curl -s -X POST $API -H "Content-Type: application/json" -d '{"items":[{"id":"seed-dino","cantidad":1}],'"$CLIENTE"',"entrega":{"tipo":"envio_nacional"}}'
# 409 (más que el stock e inexistente), no crea pedido
curl -s -X POST $API -H "Content-Type: application/json" -d '{"items":[{"id":"seed-robot","cantidad":3},{"id":"no-existe","cantidad":1}],'"$CLIENTE"',"entrega":{"tipo":"retiro"}}'
# Válido, con precios que se ignoran → 500 sin token / 201 con token
curl -s -X POST $API -H "Content-Type: application/json" -d '{"items":[{"id":"seed-dino","cantidad":2,"precio":1}],'"$CLIENTE"',"entrega":{"tipo":"retiro"},"total":1}'
# 429: repetí cualquiera 11 veces
```

**Verificado en esta sesión** (API en proceso con un script de `fetch` en el scratchpad, separando el límite por IP con `X-Forwarded-For`; front con Chrome headless por CDP contra `vite` en 5174 y la API en 4000):

*API* (48 chequeos, todos OK):
- **400:** el cuerpo inválido del ejemplo → `items`, `cliente.nombre`, `cliente.apellido`, `cliente.dni`, `cliente.celular`, `cliente.email`, `entrega.tipo` y `entrega.notas`. También: items vacío, 21 líneas, id repetido y email de 121.
- **Dirección:** nacional sin dirección → calle, número, localidad, provincia y código postal; local sin dirección → calle sí, localidad no; número de 11, piso de 21, "Santa Fé" y CP `29001` → sus cuatro claves.
- **Envío deshabilitado:** con `envioLocal.habilitado: false` → 400 en `entrega.tipo` ("Esa forma de entrega no está disponible. Elegí otra.").
- **409:** robot ×3 (stock 2), pelota inactiva, un id inexistente y dino ×1 → `sin_stock` con `stockDisponible: 2`, dos `no_disponible`, el dino no aparece y la cantidad de pedidos no cambió.
- **500:** sin `MP_ACCESS_TOKEN` → "Falta configurar Mercado Pago." y ningún pedido nuevo.
- **502:** con un token inválido, 3 pedidos (retiro con `precio: 1` y `total: 1` en el cuerpo, local y nacional):
  - 502 con el mensaje del brief;
  - los tres `cancelado`, con historial `pendiente_pago, cancelado` y `mp.detalle` "No se pudo crear la preferencia: invalid access token";
  - montos de Sanity (`77.900` y no `1`), ítem con la URL base del CDN, DNI `30123456`, celular `5493364123456` y email en minúsculas; el retiro, sin dirección;
  - envío local: `costoEnvio` 3000, localidad y provincia forzadas aunque mandé "Rosario"/"Córdoba", y CP `B2900ABC`;
  - nacional: `costoEnvio` 0;
  - números **1, 2 y 3**, `stockDescontado: false` y `createdAt`.
- **429:** 10 respuestas 400 y la undécima 429 con "Hiciste muchos pedidos seguidos. Esperá unos minutos."; otra IP, 400.

*Front* (375px: 47 chequeos; 1280px: 45; todos OK, sin errores de JavaScript):
- vacío: mensaje, "Ver productos" a `/#productos`, título de la pestaña;
- 375: resumen cerrado con "4 productos · $84.100", arriba del formulario, y se abre; 1280: sin el botón, dos columnas y el resumen `sticky` a la derecha;
- resumen: 3 ítems con miniatura y "2 × $26.400"; retiro "Gratis", local "$3.000" (el total sube) y nacional "A coordinar";
- retiro sin dirección y con dirección y horarios; local con calle, número, piso y CP, sin localidad ni provincia; nacional con localidad y las 24 provincias;
- "Editar carrito" abre el drawer;
- radios: flecha abajo elige el siguiente, la tarjeta tiene contorno de foco y fondo amarillo;
- vacíos: 10 errores, el foco en "Nombre", `aria-invalid` y `aria-describedby`, y el mensaje general; al escribir, se va el error del campo;
- celular pegado completo → `3364123456`;
- errores de la API en DNI, email y CP, con el foco en DNI y "Revisá los datos del pedido." en el recuadro;
- recargar conserva todo (también el tipo de entrega, la provincia y las notas), en `sessionStorage` y no en `localStorage`;
- 409 (robot a stock 1 y pelota inactiva en Sanity): el aviso con el foco, arriba del resumen; robot "1 × $26.400" con "Quedan 1", pelota tachada con "Sin stock"; el carrito guardado con 2 ítems y el header en 2;
- sin token: "Falta configurar Mercado Pago.", el botón habilitado de nuevo y nada en `mundo-mickey:ultimo-pedido`;
- sin scroll horizontal, ningún control de menos de 44px e inputs de 16px.

*"Gratis":* con `envioLocal.costo: 0`, el detalle del dino dice "Envío en San Nicolás · Gratis" (sin "$0") y en el checkout la tarjeta y el resumen dicen "Gratis".

*Script de imágenes:* con una copia temporal del script con `HORAS = 0`, una imagen de prueba usada por un pedido y otra suelta: lista solo la suelta ("fotos usadas en pedidos" la cuenta). Con `MONGODB_URI` apuntando a un puerto cerrado: "No se pudieron leer los pedidos de MongoDB… No se borró nada" y código 1. Con la configuración real no hay huérfanas (6 imágenes, todas en productos).

*Build:* `npm run build` sin errores. En `dist/` no aparecen `mercadopago`, `MercadoPagoConfig`, `mongoose`, `express`, `statement_descriptor`, `MP_ACCESS_TOKEN` ni `SANITY_WRITE_TOKEN`.

*Al terminar:* borré los 3 pedidos de prueba y el contador de `mundo-mickey-dev` (0 pedidos, 0 contadores: el próximo es el #0001), las 2 imágenes y el pedido de la prueba del script. Productos como el seed (stocks 3/5/4/2/6/8, todos activos) y la configuración igual al backup del principio.

**Preferencia que se manda** (ejemplo con `SITE_URL=http://localhost:5173`, dino ×2 y envío local):
```json
{
  "items": [
    { "id": "seed-dino", "title": "Dino de peluche", "quantity": 2, "unit_price": 21500, "currency_id": "ARS",
      "picture_url": "https://cdn.sanity.io/images/de0zicdv/production/<hash>-200x200.svg?w=400&h=400&fit=max&fm=jpg&q=80" },
    { "id": "envio", "title": "Envío en San Nicolás", "quantity": 1, "unit_price": 3000, "currency_id": "ARS" }
  ],
  "payer": { "name": "Ana", "surname": "Pérez", "email": "ana@ejemplo.com", "identification": { "type": "DNI", "number": "30123456" } },
  "external_reference": "<_id del pedido>",
  "back_urls": {
    "success": "http://localhost:5173/pago/exito?pedido=<_id>",
    "failure": "http://localhost:5173/pago/error?pedido=<_id>",
    "pending": "http://localhost:5173/pago/pendiente?pedido=<_id>"
  },
  "auto_return": "approved",
  "statement_descriptor": "MUNDO MICKEY"
}
```
Con `SITE_URL=https://mundo-mickey.vercel.app/` se suma `"notification_url": "https://mundo-mickey.vercel.app/api/pagos/webhook"` (y la `/` del final se saca).

**Capturas** (fuera del repo), en `C:\Users\Admin\Proyectos\Mundo Mickey\capturas\08-checkout\`, a 375 y 1280px:
- `vacio-375.png` y `vacio-1280.png`;
- `retiro-375.png` y `retiro-1280.png`;
- `envio-nacional-375.png` y `envio-nacional-1280.png`;
- `errores-375.png` y `errores-1280.png` (errores de la API);
- `conflicto-409-375.png` y `conflicto-409-1280.png`;
- `detalle-envio-gratis-375.png` (el detalle con costo 0).
