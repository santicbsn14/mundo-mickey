# Avance 09 — Webhook, resultado del pago y estado del pedido

## Qué se hizo
- **Paso 0 — pendientes del 08:** **no se pudieron correr.** `MP_ACCESS_TOKEN` sigue sin estar en el `.env` (está comentado), igual que `MP_WEBHOOK_SECRET`. Quedan en "Pendientes", junto con todo lo que necesita Mercado Pago real.
- **Túnel https (Paso 1):**
  - `cloudflared.exe` 2026.10.5 portable, bajado de los releases oficiales de GitHub (`cloudflare/cloudflared`, `cloudflared-windows-amd64.exe`) a `C:\Users\Admin\Proyectos\Mundo Mickey\herramientas\cloudflared.exe`, fuera del repo. Firma Authenticode válida de "Cloudflare, Inc.".
  - `npm run tunel` (`scripts/tunel.js`): levanta un Quick Tunnel hacia `http://localhost:5173`, o al puerto que se le pase (`npm run tunel -- 5174`). Resalta la URL como `➜  SITE_URL=https://….trycloudflare.com`. Si falta el `.exe`, dice dónde descargarlo y dónde guardarlo. Si el DNS no resuelve `trycloudflare.com`, lo explica.
  - `vite.config.ts`: `server.allowedHosts: ['.trycloudflare.com']`. Es solo para el servidor de desarrollo: no afecta al build.
  - **En esta PC el túnel no levanta:** el DNS de la red (el router) responde que `api.trycloudflare.com` no existe, aunque `1.1.1.1` sí lo resuelve. Ver "Pendientes".
- **`DEPLOY.md`:**
  - `MP_WEBHOOK_SECRET` en la tabla de Vercel;
  - nueva sección **"Probar pagos en la PC"**: `cloudflared`, cuentas de prueba, túnel, `SITE_URL` y reinicio de la API, CORS de Sanity para el origen del túnel, configuración del webhook en **modo prueba** con su clave secreta, comprar desde la URL del túnel, qué revisar, qué hacer al terminar, la tabla de tarjetas de prueba vigente de Mercado Pago Argentina (con `APRO`, `OTHE`, `CONT` y los demás nombres), problemas del túnel y **webhooks en producción** (modo productivo, dominio final y la clave en Vercel).
- **`.env.example`:** `MP_WEBHOOK_SECRET=`, con qué es y de dónde sale, y en `SITE_URL` la mención del túnel.
- **Preferencia** (`server/lib/mercadopago.js`):
  - `expires: true` y `expiration_date_to` a 24 h, con la hora de Argentina (`2026-10-28T20:40:49.439-03:00`);
  - `payment_methods.excluded_payment_types: [{ id: 'ticket' }, { id: 'atm' }]`;
  - `notification_url` con `?source_news=webhooks` (ver "Decisiones");
  - un cliente `Payment` (comparte el `MercadoPagoConfig` con `Preference`) con `obtenerPago(id)`, que se puede reemplazar con `reemplazarConsultaPago(fn)` desde un script de prueba;
  - `firmaValida(...)`, la validación de `x-signature`.
- **Modelo `EventoWebhook`:** todos los campos del brief, con un índice TTL de 30 días sobre `recibidoEn` (`expireAfterSeconds: 2592000`, verificado en Mongo). Colección `eventowebhooks`. Guarda `query` y `body` como texto (ver "Decisiones"). No guarda headers, salvo `x-request-id`.
- **`server/lib/pagos.js` — `procesarPago(pagoId, { pago? })`:** los 9 puntos del brief, con el descuento de stock en **una sola transacción de Sanity** (ver "Decisiones"). También `anotar(pedidoId, texto)`, que suma una línea con fecha a `notaInterna`, sin repetirla y en forma atómica.
- **`POST /api/pagos/webhook`:**
  - firma inválida o ausente → 401 y `firma_invalida` sin consultar el pago;
  - tipos que no son `payment` → 200 `ignorado`;
  - procesa y **recién después responde**: 200 si se procesó o se ignoró, 500 si falló Mercado Pago, Mongo o Sanity;
  - siempre registra el `EventoWebhook` con resultado y duración;
  - sin `requiereAdmin` ni límite;
  - un cuerpo vacío no rompe nada.
- **`GET /api/pedidos/:id/estado`** (`server/routes/pedidos.js` + `server/controllers/pedidos.js`):
  - responde solo `{ numero, estado, tipoEntrega }`, con `Cache-Control: no-store`;
  - id inválido o inexistente → 404;
  - límite de 30 por IP por minuto;
  - reconciliación con `?pago=` solo si el `external_reference` de ese pago es el pedido.
- **Front `/pago/:resultado`** (`src/pages/PagoResultado.tsx` y `src/components/pago/`: `ResultadoPago`, `BotonesPago` y `DetalleEntrega`, cada uno con su CSS, más el hook `useEstadoPedido.ts`):
  - **pedido:** se toma de `?pedido=` o de `mundo-mickey:ultimo-pedido`; a la API se le pasa `payment_id` (o `collection_id`) como `?pago=`;
  - **éxito:**
    - consulta cada 3 s hasta 60 s, con "Estamos confirmando tu pago…" y un aro que gira (quieto y punteado con `prefers-reduced-motion`);
    - **pagado:** "¡Listo! Tu pedido #0007 está confirmado.", vacía el carrito, borra `mundo-mickey:checkout` y `mundo-mickey:ultimo-pedido`, y muestra el texto de cada entrega (en retiro, con dirección y horarios);
    - a los 60 s, "Tu pago se está procesando." + "Apenas se acredite te avisamos.", sin vaciar nada;
    - botones "Escribinos por WhatsApp" (`Hola! Hice el pedido #0007`) y "Volver a la tienda";
  - **pendiente:** consulta una vez; si ya está pagado, muestra lo mismo que éxito;
  - **error:** "No se pudo completar el pago." con "Volver a intentar" (a `/checkout`) y WhatsApp;
  - **sin pedido o 404:** "No encontramos tu pedido." con "Volver a la tienda";
  - un `/pago/otra-cosa` muestra el NotFound;
  - `document.title` según lo que se ve, y el foco va al título cuando cambia el mensaje.
- **`src/lib/formato.ts`:** `numeroPedido(7)` → `"#0007"`.
- **`ARQUITECTURA.md`:** en "Endpoints", `/api/pedidos/:id/estado` con la reconciliación; en "Decisiones tomadas", el vencimiento a 24 h y la exclusión del efectivo.

## Archivos creados / modificados
- **Nuevos:**
  - `server/models/EventoWebhook.js`;
  - `server/lib/pagos.js`;
  - `server/routes/pedidos.js` y `server/controllers/pedidos.js`;
  - `src/components/pago/ResultadoPago.tsx`/`.css`, `BotonesPago.tsx`/`.css`, `DetalleEntrega.tsx`/`.css` y `useEstadoPedido.ts`;
  - `scripts/tunel.js`;
  - `docs/avances/09-webhook.md`.
- **Modificados:**
  - `server/lib/mercadopago.js`, `server/controllers/pagos.js`, `server/routes/pagos.js` y `server/app.js`;
  - `src/pages/PagoResultado.tsx` (reemplaza el placeholder) y `src/lib/formato.ts`;
  - `vite.config.ts`, `package.json` (script `tunel`) y `.env.example`;
  - `docs/DEPLOY.md` y `docs/ARQUITECTURA.md` (solo lo indicado).
- Fuera del repo: `Mundo Mickey/herramientas/cloudflared.exe`. `.env`: sin cambios (`SITE_URL=http://localhost:5173`).

## Decisiones tomadas durante la implementación
- **Descuento de stock en una sola transacción de Sanity, con `transactionId` fijo** (`descuento-stock-<pedidoId>`).
  - Todos los ítems van en la misma transacción, y cada patch lleva `ifRevisionId(_rev)`.
  - Si otro cambio se adelantó (cambió la revisión), se vuelve a leer y se reintenta, hasta 3 veces.
  - **Comprobé que Sanity rechaza un `transactionId` repetido** (409 "A transaction with the ID … already exists"). Por eso el descuento se aplica **una sola vez**, aunque:
    - dos notificaciones lo intenten a la vez;
    - la reconciliación y el webhook coincidan;
    - un intento anterior haya descontado y se haya cortado antes de marcar `stockDescontado`.
  - Es todo o nada: no puede quedar un pedido con la mitad de los productos descontados. Cumple lo del brief ("por cada ítem… `ifRevisionID`… hasta 3 veces") sin el riesgo de un descuento parcial.
  - Quien recibe el "already exists" marca `stockDescontado: true` y responde `ignorado`.
- **"Guarda siempre" `mp.*`, salvo con un pedido ya cobrado con otro pago.** Pasa, por ejemplo, con un `rejected` viejo que Mercado Pago reenvía después del `approved`. Ese pago no pisa `mp.pagoId` ni `mp.estadoPago` (`ignorado`). Si es otro `approved`, se anota "Revisar: … Puede ser un cobro doble.".
- **`approved` para un pedido `enviado` o `entregado`:** cuenta como ya pagado (no hace nada). Para `cancelado` o `rechazado`, se anota "Revisar: llegó el pago aprobado … No se cambió el estado." y el resultado es `ignorado`.
- **Pago inexistente en Mercado Pago (404)** → 200 `ignorado`, para que no se reintente para siempre (pasa con "Simular notificación" con un id inventado). Cualquier otro error de Mercado Pago → 500.
- **`notaInterna`:** cada nota va en una línea con la fecha (`27/10/2026 — Sobreventa: …`) y no se repite si Mercado Pago reenvía el evento. El update es un pipeline atómico con `$literal`.
- **Firma:**
  - manifiesto `id:<data.id>;request-id:<x-request-id>;ts:<ts>;`, con `data.id` del query string (en minúsculas si es alfanumérico) y HMAC-SHA256 en hex;
  - se compara con `crypto.timingSafeEqual` y se exige un `v1` de 64 caracteres hex;
  - si falta `data.id` o `x-request-id`, ese par se omite. Es la regla que documenta Mercado Pago y la que aplica el `WebhookSignatureValidator` del SDK 3.6.1 (lo leí en `node_modules`; ver "Desvíos").
  - No se valida la antigüedad del `ts` (el SDK tampoco lo hace por defecto).
- **Sin `MP_WEBHOOK_SECRET` el webhook responde 500 ("Webhook sin configurar.")**, no 401, y lo registra como `error`. Es un problema de configuración, no del que llama, y con 500 Mercado Pago reintenta cuando ya está la clave.
- **`notification_url` con `?source_news=webhooks`:** con la `notification_url` de la preferencia, Mercado Pago también puede mandar notificaciones **IPN** (`?topic=…&id=…`), que **no vienen firmadas**: todas terminarían en 401 y en reintentos. Con `source_news=webhooks` solo manda Webhooks (firmados). El `data.id` y el `type` siguen llegando en el query string.
- **`query` y `body` del `EventoWebhook` como texto** (el body en JSON, recortado a 4 KB). Mongo no acepta bien claves con punto, como `data.id` del query, y un cuerpo arbitrario podría traer claves con `$`. Los datos que se buscan (`tipo`, `pagoId`, `pedidoId`, `resultado`) van en campos propios.
- **Tipo de la notificación:** `type` o `topic` del query, y si no, del body. Solo se procesa con un `data.id` numérico.
- **Reconciliación:** si no hay `MP_ACCESS_TOKEN`, ni lo intenta. Si falla, responde el estado que había: la página sigue consultando y el webhook es la fuente de verdad. Consulta el pago una vez y se lo pasa a `procesarPago` para no pedirlo dos veces.
- **Límite de `/estado` y las 20 consultas de la página:** 60 s cada 3 s son 20 o 21 consultas, dentro de las 30 por minuto. Si algún 429 llegara, el front lo trata como un error pasajero y sigue.
- **Front:**
  - el pedido y el pago se leen una sola vez al montar, porque al confirmarse se borra `mundo-mickey:ultimo-pedido` y el pedido no tiene que cambiar;
  - en pendiente y error, mientras llega la única consulta, no se muestra ningún mensaje, para no mostrar uno y cambiarlo;
  - `pedido` con `cancelado` o `rechazado` → la vista de error;
  - `payment_id=null` (lo manda Mercado Pago en algunos rechazos) no se manda;
  - en la de error, debajo del título: "Tu carrito y tus datos siguen guardados: podés volver a intentar con otro medio de pago.".
- **Diseño:**
  - una tarjeta centrada, de hasta 640px, con borde negro y radio de 22px;
  - el ícono en un círculo negro con amarillo, y la tarjeta amarilla cuando el pedido está confirmado;
  - botones pill de 52px de alto, a todo el ancho en el celular y uno al lado del otro desde 520px;
  - dirección y horarios en un recuadro blanco.

## Desvíos respecto al brief
- **Paso 0 y todos los criterios con Mercado Pago real: no se corrieron** (faltan las credenciales en el `.env`).
- **El túnel no se pudo probar de punta a punta** (DNS de la red; ver "Pendientes"). Sí se verificó que Vite acepta un `Host: x.trycloudflare.com` (200 en la página y el webhook pasa por el proxy) y rechaza otros hosts (403).
- **La firma se implementó a mano** (como pide el brief) y no con `WebhookSignatureValidator` del SDK, que existe desde la 3.x y hace lo mismo. Detalle que no estaba en el brief: si falta `x-request-id`, su par se omite del manifiesto (regla de la documentación). Se podría exigir siempre `x-request-id`. **A definir.**
- **`?source_news=webhooks` en la `notification_url`:** no estaba en el brief (ver "Decisiones").
- **El descuento por transacción** en lugar de un patch por ítem (ver "Decisiones"). No hizo falta tocar el modelo `Pedido`.
- **`src/components/pago/useEstadoPedido.ts`:** el hook va junto a sus componentes y no en `src/hooks/`, porque solo lo usa esta página.
- **Texto extra en `/pago/error`** (la línea de "Tu carrito y tus datos siguen guardados"). En "procesando" y "pendiente", la frase del brief quedó partida en título ("Tu pago se está procesando.") y texto ("Apenas se acredite te avisamos.").

## Pendientes / problemas encontrados
- **Credenciales:** falta en el `.env` `MP_ACCESS_TOKEN` (Access Token de producción de la cuenta de prueba **vendedor**) y `MP_WEBHOOK_SECRET` (clave secreta de **modo prueba** de la aplicación). Con eso quedan por correr:
  - [ ] los pendientes del 08 (201 con `initPoint`, `mp.preferenciaId`, la preferencia en la API de Mercado Pago, `auto_return` con localhost, el checkout con el total correcto);
  - [ ] la preferencia con vencimiento a 24 h y sin efectivo, vista en el checkout de Mercado Pago (que no aparezcan Rapipago ni Pago Fácil) y en `GET /checkout/preferences/:id`;
  - [ ] pago aprobado con `APRO` → webhook firmado, pedido `pagado`, stock en Sanity, `stockDescontado: true` y "¡Listo!" con el carrito vacío;
  - [ ] `OTHE` → sigue `pendiente_pago`, `/pago/error` con el carrito;
  - [ ] el mismo pedido con `APRO` después → `pagado`;
  - [ ] el reenvío de Mercado Pago no descuenta de nuevo;
  - [ ] `EventoWebhook` de cada notificación real (y confirmar que con `source_news=webhooks` no llegan IPN sin firma).
- **El túnel no levanta en esta red:** `failed to request quick Tunnel: … lookup api.trycloudflare.com: no such host`. El DNS del router (`fe80::1`) responde NXDOMAIN para `trycloudflare.com`; `nslookup api.trycloudflare.com 1.1.1.1` sí lo resuelve. Para probar, **Santiago tiene que elegir** entre:
  - poner DNS `1.1.1.1` / `1.0.0.1` en el adaptador de Windows (necesita admin);
  - usar otra red (el celular compartiendo internet).
  
  No lo cambié. Está en "Si el túnel no levanta" de `DEPLOY.md`.
- **CORS de Sanity con el túnel:** el origen del túnel cambia en cada corrida y hay que sumarlo (y sacarlo) cada vez. Está en `DEPLOY.md`. Alternativa para más adelante: un túnel con nombre fijo (necesita cuenta de Cloudflare y dominio).
- **Si el proceso se corta después de la transacción de Sanity y antes de anotar las notas** (sobreventa), el reintento ve "already exists" y no las escribe. Es muy improbable; queda dicho.
- **Sanity guarda los `transactionId` en el historial del dataset;** si el historial se recortara (según el plan), un reintento muy tardío podría no detectar el repetido. Mercado Pago reintenta en horas o pocos días, y además el pedido ya queda `stockDescontado: true` en el primer intento completo.
- **El JS de la tienda pasó de 434,43 kB a 440,63 kB** (+6,2 kB; 135,79 kB gzip).
- **ARQUITECTURA.md, propuesta (no lo toqué):** en "Flujo de pago", el paso 4 podría decir que el descuento es una transacción única de Sanity con `transactionId` por pedido, y que el pedido se busca por `external_reference` y se valida monto y moneda. El paso 5 podría mencionar la reconciliación con `?pago=`.

## Cómo probarlo
**Sin Mercado Pago (lo que se corrió en esta sesión):**

*API* — script en el scratchpad (`prueba-webhook.mjs`). Levanta `server/app.js` en el 4100 con un `Payment.get` falso (`reemplazarConsultaPago`), `MP_WEBHOOK_SECRET` de prueba, eventos firmados por el script, Mongo `mundo-mickey-dev` y Sanity real. **72 chequeos, todos OK:**
- **Firma:**
  - 401 con otro secreto, sin `x-signature`, mal formada y con la firma de otro `data.id`;
  - en ninguno de esos casos se consultó el pago;
  - `EventoWebhook` `firma_invalida` con `firmaValida: false`;
  - `ABC123` firma como `abc123`, y sin `x-request-id` se omite el par.
- **Cuerpos y tipos:**
  - cuerpo vacío con y sin `Content-Type` → no rompe;
  - `merchant_order` firmado → 200 `ignorado` (con su evento);
  - pago inexistente (404) → 200 `ignorado`.
- **`approved` 3 veces seguidas:**
  - 200 las 3; la primera `procesado` y las otras `ignorado`;
  - `pagado`, `stockDescontado`, `mp.pagoId`/`estadoPago`/`detalle`;
  - historial `pendiente_pago,pagado`; dino 5 → 3;
  - 3 eventos con `pedidoId` y `duracionMs`.
- **`approved` 3 veces en paralelo:**
  - una `procesado`, un solo `pagado` en el historial, conejo −1 y pelota −3 una sola vez;
  - webhook + 2 reconciliaciones a la vez: el cohete baja 1.
- **Monto y moneda:**
  - monto 100 → sigue `pendiente_pago`, con el motivo en `mp.detalle` y "Revisar: el monto pagado no coincide" en la nota (no se repite al reenviar);
  - `USD` → sigue pendiente; el stock no cambia.
- **`rejected` → `approved`:**
  - `rejected`, `in_process`, `pending` y `cancelled` → sigue `pendiente_pago`;
  - `approved` después → `pagado`;
  - el `rejected` viejo reenviado no pisa el pago;
  - `refunded` → sigue `pagado` con nota;
  - otro `approved` → nota de cobro doble, sin descontar.
- **`approved` con el pedido `cancelado`:** `ignorado`, sigue `cancelado`, con la nota y sin cambios de stock.
- **Sobreventa:** robot ×5 con stock 2 → robot en 0, nota "Sobreventa: Robot que camina (pedido #00NN, había 2)". Un producto inexistente → "Producto eliminado: …".
- **Sanity caído** (`fetch` que tira 503):
  - 500, pedido `pagado` con `stockDescontado: false`, evento `error` y stock sin cambios;
  - el reintento → 200 `procesado`, dino −1;
  - otro reintento no descuenta;
  - con `stockDescontado` vuelto a `false` a mano (simulando un corte después de la transacción), el reintento no descuenta de nuevo.
  - Mercado Pago caído → 500.
- **`/estado`:**
  - 404 con id inválido e inexistente;
  - solo `estado,numero,tipoEntrega`;
  - `?pago=` de otro pedido → nada cambia; `?pago=abc` → se ignora;
  - `?pago=` propio aprobado → `pagado` con stock descontado; uno rechazado → sigue pendiente;
  - 30 → 200 y la 31 → 429.
- **Preferencia:**
  - `expires: true` y vence en 24 h (±1 min), con formato `…T…000-03:00`;
  - `excluded_payment_types` `ticket` y `atm`;
  - `notification_url` `https://…/api/pagos/webhook?source_news=webhooks`.
- **TTL:** índice `recibidoEn` con `expireAfterSeconds: 2592000`.

*Front* — `prueba-front.mjs` en el scratchpad, con Chrome headless por CDP contra Vite en el 5174 y la API en el 4000. Los pedidos se crearon en Mongo y se pasaron a `pagado` a mano para simular el webhook; cada sección usa su propia IP con `X-Forwarded-For`. **87 chequeos (43 a 375px, 43 a 1280px y 1 con movimiento reducido), todos OK, sin errores de JavaScript:**
- **Sin pedido:** sin pedido, con un id inexistente y con un id inválido → "No encontramos tu pedido." con solo "Volver a la tienda"; `/pago/otra-cosa` → NotFound.
- **Éxito:**
  - pedido tomado de `sessionStorage`, "Estamos confirmando tu pago…" con el aro girando y título "Confirmando tu pago";
  - consulta con `?pago=123456789` (`payment_id`, aunque también venía `collection_id`) y vuelve a consultar;
  - al pasarlo a `pagado`: "¡Listo! Tu pedido #0001 está confirmado.", el texto de retiro con dirección y horarios, el carrito vacío y las dos claves borradas;
  - el foco en el título; WhatsApp con `Hola! Hice el pedido #0001`;
  - con Tab, el botón tiene un contorno sólido de 3px; botones de 44px o más;
  - envío local y nacional con su texto.
- **60 s:** "Tu pago se está procesando." + "Apenas se acredite te avisamos.", 20 o 21 consultas y después ninguna más; el carrito y lo guardado siguen.
- **Pendiente:** el mensaje y el título; no repite la consulta (en el build de producción con `vite preview`: **1 sola consulta**; en desarrollo son 2 por `StrictMode`); el carrito sigue; con un pedido pagado → "¡Listo!".
- **Error:** el mensaje, la línea del carrito, "Volver a intentar" → `/checkout` y WhatsApp; `payment_id=null` no se manda; "Volver a intentar" lleva a "Finalizar compra" con el carrito y los datos.
- **Sin scroll horizontal** en todas, a 375 y 1280.
- **`prefers-reduced-motion`:** el indicador sin animación y punteado.

*Build:* `npm run build` sin errores. En `dist/` no aparecen `mercadopago`, `MercadoPagoConfig`, `mongoose`, `express`, `createHmac`, `excluded_payment_types`, `descuento-stock`, `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET` ni `SANITY_WRITE_TOKEN`. Los secretos no aparecen en `src/`, en archivos versionados ni en este avance.

*Al terminar:* `mundo-mickey-dev` con 0 pedidos, 0 `eventowebhooks` (la colección queda, con su índice TTL) y sin contador. El stock como el seed (osito 3, dino 5, cohete 4, robot 2, conejo 6, pelota 8, todos activos), restaurado por script con los valores del seed. La configuración, sin tocar (su `_updatedAt` es anterior a la sesión). `SITE_URL=http://localhost:5173`.

**Con Mercado Pago** (cuando estén las credenciales y el túnel): seguir "Probar pagos en la PC" en `DEPLOY.md`. Para el Paso 0, ver la preferencia:
```bash
curl -s https://api.mercadopago.com/checkout/preferences/<preferenciaId> \
  -H "Authorization: Bearer $(grep ^MP_ACCESS_TOKEN= .env | cut -d= -f2)"
```

**Un evento firmado a mano** (Git Bash, con la API en el 4000 y `MP_WEBHOOK_SECRET` en el `.env`):
```bash
SECRETO=$(grep ^MP_WEBHOOK_SECRET= .env | cut -d= -f2); ID=123; RID=prueba-1; TS=$(date +%s)
V1=$(printf "id:$ID;request-id:$RID;ts:$TS;" | openssl dgst -sha256 -hmac "$SECRETO" | sed 's/^.* //')
curl -s -X POST "http://localhost:4000/api/pagos/webhook?data.id=$ID&type=payment" \
  -H "x-request-id: $RID" -H "x-signature: ts=$TS,v1=$V1" -H "Content-Type: application/json" -d '{}'
# → 200 {"ok":true,"resultado":"ignorado"} (el pago 123 no existe). Con otra firma → 401.
```

**Capturas** (fuera del repo), en `C:\Users\Admin\Proyectos\Mundo Mickey\capturas\09-webhook\`, a 375 y 1280px:
- `confirmando-375.png` y `confirmando-1280.png`;
- `exito-retiro-375.png` y `exito-retiro-1280.png` (se ve el contorno de foco en "Escribinos por WhatsApp", de la prueba con Tab);
- `exito-envio-nacional-375.png` y `exito-envio-nacional-1280.png`;
- `procesando-375.png` y `procesando-1280.png` (a los 60 s);
- `pendiente-375.png` y `pendiente-1280.png`;
- `error-375.png` y `error-1280.png`;
- `sin-pedido-375.png` y `sin-pedido-1280.png`.
