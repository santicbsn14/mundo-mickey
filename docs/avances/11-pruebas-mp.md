# Avance 11 — Pruebas de Mercado Pago de punta a punta

## Qué se hizo
- **Paso 0 — `/api/health` con Mercado Pago:**
  - `mp`: `"ok" | "error" | "sin_configurar"`, consultando `GET https://api.mercadopago.com/users/me` con el token y 3 s de límite (`diagnosticoMp()` en `server/lib/mercadopago.js`). El motivo va en `errores.mp`, sin el token (probado con un token falso: `Mercado Pago respondió 403: At least one policy returned UNAUTHORIZED.`). No cambia `ok` ni el código de respuesta.
  - `mpWebhook`: `"configurado" | "sin_configurar" | "invalido"` (ver "Desvíos").
  - En el log (no en la respuesta): el prefijo del token, si el usuario de `users/me` es de prueba, sus tags y el `SITE_URL` exacto. Con las credenciales de prueba de la aplicación:
    `Health: Mercado Pago ok. Token APP_USR-…; usuario DE PRUEBA (site MLA, tags: user_product_seller, test_user, normal)`.
    **El token de prueba también empieza con `APP_USR-`:** el prefijo no alcanza para distinguirlo; `users/me` sí (tag `test_user`).
  - En Vercel: `{"ok":true,"db":"conectada","sanity":"ok","mp":"ok","mpWebhook":"configurado","entorno":"production"}`. Después del cambio de `mpWebhook`, da `"invalido"` (la clave cargada es la tapada; ver "Pendientes").
- **Paso 1 — pendientes del 08 (local, API en el puerto 4100):**
  - Pedido válido (Dino ×1 + Pelota ×2, envío en San Nicolás) → **201** `{ pedidoId, numero: 5, initPoint }`; el pedido con `mp.preferenciaId`.
  - `GET /checkout/preferences/:id`: los tres ítems con `currency_id: ARS` más "Envío en San Nicolás" a $3000; `external_reference` = `_id` del pedido; `payer` con nombre y email; `statement_descriptor: MUNDO MICKEY`; `expires: true` y `expiration_date_to` a las 24 h (`-03:00`); `excluded_payment_types` `ticket` y `atm`.
  - **Con `SITE_URL=http://localhost:5173`** Mercado Pago rechaza `auto_return` (la API reintenta sin él, como estaba previsto) y **además descarta las `back_urls`** (vuelven vacías) y no hay `notification_url`. Con `SITE_URL=https://mundo-mickey.vercel.app` la misma preferencia sale con las tres `back_urls`, `auto_return: approved` y `notification_url` `…/api/pagos/webhook?source_news=webhooks`.
  - **`init_point` vs `sandbox_init_point`:** la preferencia devuelve los dos (`www.mercadopago.com.ar/checkout/v1/redirect?pref_id=…` y `sandbox.mercadopago.com.ar/…`). La documentación vigente de Checkout Pro Argentina ("Probar la integración") dice usar las credenciales de prueba de la aplicación y pagar **sin cuenta de prueba comprador, en incógnito y sin iniciar sesión**; no menciona `sandbox_init_point`. En la compra 1, **el `init_point` normal aceptó la tarjeta de prueba**: se sigue usando `init_point` y no se agregó `sandbox_init_point` (documentado en `ARQUITECTURA.md`). Chrome headless no sirve para esto: Mercado Pago responde "Hubo un error accediendo a esta página" en los dos links.
- **`SITE_URL` en Vercel:** los primeros pedidos del deploy (#1 a #4 de Santiago y #7, creado por API para verificar) tenían la preferencia **sin `back_urls`, `auto_return` ni `notification_url`**: `SITE_URL` no empezaba con `https://` en ese deploy. Santiago lo dejó en `https://mundo-mickey.vercel.app` con Redeploy, y el pedido #8 (creado por API contra Vercel) ya salió completo. En el código: `sitio()` saca espacios, comillas y la `/` final, y en Vercel el checkout deja un error en el log si `SITE_URL` no es https.
- **"Una de las partes con la que intentás hacer el pago es de prueba"** (#1 a #4): Santiago pagó logueado con su cuenta real a un vendedor de prueba. Se resolvió pagando en incógnito, sin sesión y con un email inventado. Está en `DEPLOY.md`.
- **Paso 2 — compras en Vercel** (Santiago en el navegador, en incógnito, como invitado, Mastercard de prueba; verificación en `mundo-mickey-dev`, Sanity y `GET /v1/payments`). Stock inicial = seed (Cohete 4, Conejito 6, Dino 5, Osito 3, Pelota 8, Robot 2).

  | Compra | Pedido | Entrega e ítems | Total (MP) | Pago MP | Estado final | Stock en Sanity |
  |---|---|---|---|---|---|---|
  | 1. Aprobado, retiro (`APRO`) | #0009 | retiro; Conejito ×1 | $15.900 ARS | `approved` / `accredited` | `pagado` (19:20:39); después Santiago lo pasó a `entregado` probando el panel | Conejito 6 → 5 |
  | 2. Aprobado, San Nicolás (`APRO`) | #0010 | envío local, Mitre 450 2B, CP 2900; Dino ×1 + Cohete ×1 | **$43.400** (40.400 + 3.000 de envío) | `approved` / `accredited` | `pagado` | Dino 5 → 4, Cohete 4 → 3 |
  | 3a. Rechazado (`OTHE`) | #0012 | nacional, San Martín 1200, Rosario, Santa Fe, CP 2000; Pelota ×1 | $9.800 | `rejected` / `cc_rejected_other_reason` | `pendiente_pago`, con `mp.estadoPago: rejected` | sin cambio |
  | 3b. Reintento (`APRO`) | #0013 (nuevo) | igual que 3a | $9.800 | `approved` / `accredited` | `pagado` | Pelota 8 → 7 |
  | 4. Pendiente (`CONT`) | #0014 | retiro; Robot ×1 | $26.400 | `in_process` / `pending_contingency` | `pendiente_pago` | Robot 2 (sin cambio) |

  - En todos los pagados: monto y moneda validados (`transaction_amount` = total, `ARS`), `stockDescontado: true`, `mp` con `pagoId`, `estadoPago: approved` y `detalle: accredited`, sin `notaInterna`. Los pagos llegan con `live_mode: true` aunque sean de prueba.
  - **Páginas de vuelta** (lo que vio Santiago): 1 y 2 volvieron solas a `/pago/exito` con "¡Listo!" y el carrito vacío; 3a a `/pago/error` con la Pelota en el carrito, "Volver a intentar" con los datos ya cargados, y 3b a "¡Listo!" con el mensaje de coordinar el envío por WhatsApp; 4 a `/pago/pendiente`.
  - **Panel en Vercel:** #0009 en "A preparar" con el badge; #0014 en "Pendientes de pago"; WhatsApp del #0010 abrió con el número de pedido. Por la API del panel en Vercel (login con las credenciales de desarrollo): `pagado` → #0013 y #0010; el detalle del #0010 trae cliente, dirección completa, ítems, total y `mp`.
  - **El reintento crea un pedido nuevo** (#0013); el rechazado (#0012) queda en `pendiente_pago` y su preferencia vence a las 24 h. El #0011 es un pedido de la compra 3 abandonado antes de pagar (Santiago había elegido envío en San Nicolás y volvió a cambiarlo a nacional): queda pendiente, sin pago. Ninguno de los dos molesta: no tocan stock y se ven en "Pendientes de pago".
  - **Pendiente:** una hora después, el pago del #0014 seguía `in_process`; Mercado Pago no mandó nada más.
  - **Webhook (`eventowebhooks`):** llegaron **11 notificaciones**, todas `payment.created` con `?source_news=webhooks` (ninguna IPN), y **todas `firma_invalida`** (`La firma no coincide`, 401) en 0 a 2 ms (una de 1044 ms, el primer request de una instancia). Causa: en `MP_WEBHOOK_SECRET` (Vercel y `.env`) se cargó la clave **tapada** del panel (64 "•"). Por eso **todos los pagados se confirmaron por la reconciliación de `/pago/exito`** (`?pago=`), entre 4 y 8 s después del pago (por ejemplo #0009: pago 19:20:32, notificaciones 19:20:33, `pagado` 19:20:39).
    - **Dos notificaciones por pago**, con distinto `x-request-id`, al segundo: una por la `notification_url` de la preferencia y otra por la URL configurada en el panel (modo prueba).
    - Mercado Pago **reintentó** la del #0009 a los 20 minutos (19:40:34), también rechazada.
  - **Reenvío desde el panel (compra 5):** no se probó. Con la clave tapada, cualquier notificación reenviada sale `firma_invalida`, así que no prueba nada. El stock igual se descontó **una sola vez** por pedido pagado, aunque llegaron 2 o 3 notificaciones por pago (rechazadas) y la reconciliación corrió en cada vuelta a `/pago/exito`.
- **Paso 3 — docs:** `DEPLOY.md` (Vercel, Mercado Pago con el panel nuevo, probar pagos en Vercel como forma recomendada y el túnel como alternativa, problemas comunes nuevos), `ARQUITECTURA.md` y `.env.example`.
- **Limpieza:** `npm run pedidos:prueba -- --borrar` (14 pedidos y el contador), `eventowebhooks` vacía (11 borrados), `npm run seed` (stock como el seed: Cohete 4, Conejito 6, Dino 5, Osito 3, Pelota 8, Robot 2). La configuración no se tocó (envío local $3000, los dos envíos habilitados).

## Archivos creados / modificados
- `server/routes/health.js`: `mp`, `mpWebhook` y `errores.mp`.
- `server/lib/mercadopago.js`: `prefijoToken()`, `diagnosticoMp()`; `sitio()` exportada y tolerante a espacios y comillas; error en el log si en Vercel `SITE_URL` no es https.
- `server/controllers/pagos.js` y `server/models/EventoWebhook.js`: campo `firma` (header `x-signature`) solo en los eventos `firma_invalida`.
- `docs/DEPLOY.md`: sección 2 (Vercel) con los pasos reales y la tabla de variables "deploy de prueba / producción"; CORS de Sanity con el origen de Vercel; `mp` y `mpWebhook` en "Verificar"; cinco filas nuevas en "Problemas comunes"; secciones nuevas "Mercado Pago (panel nuevo)" y "Probar pagos en el deploy de Vercel (recomendado)"; "Probar pagos en la PC" pasó a alternativa, sin las cuentas de prueba vendedor/comprador.
- `docs/ARQUITECTURA.md`: credenciales de prueba de la aplicación y deploy de prueba (Stack), `init_point` siempre (Flujo de pago, paso 3), `/api/health` en Endpoints, tres decisiones nuevas (`init_point` en pruebas, dos notificaciones por pago, el reintento es un pedido nuevo) y el pendiente de Mercado Pago actualizado.
- `.env.example`: comentarios de `SITE_URL`, `MP_ACCESS_TOKEN` y `MP_WEBHOOK_SECRET`.
- `docs/avances/11-pruebas-mp.md`.

Commits: `cdb3cee` (health), `4012c15` (`SITE_URL`), `5eb591a` (`x-signature` en los eventos), `fa777ba` (`mpWebhook: invalido`) y el de cierre.

## Decisiones tomadas durante la implementación
- **`init_point` siempre, sin `sandbox_init_point`:** con las credenciales de prueba de la aplicación, el checkout normal acepta las tarjetas de prueba. Agregar la rama de sandbox sumaba código para un caso que no pasa.
- **Prueba o producción por `users/me`, no por el prefijo:** los dos tokens empiezan con `APP_USR-`. El health deja las dos cosas en el log.
- **`mp` no afecta `ok`:** si Mercado Pago está caído, la tienda igual muestra productos y el panel funciona; el health lo informa aparte.
- **Se deja la `notification_url` en la preferencia** aunque el panel tenga configurada la misma URL: no depende de la configuración del panel. La notificación doble es inofensiva (procesamiento idempotente).
- **`firma` en los eventos con firma inválida:** el `x-signature` es un HMAC, no la clave. Permite comprobar después con qué clave se firmó, sin depender de los logs de Vercel (que Santiago no encontraba y en Hobby duran 1 hora).

## Desvíos respecto al brief
- **`mpWebhook` tiene un tercer valor, `"invalido"`:** cuando la clave tiene caracteres que una clave real no puede tener (los "•" de la clave tapada). Con solo "configurado / sin_configurar", el health decía "configurado" con una clave que nunca iba a validar.
- **Cambios de código fuera del health:** `sitio()` tolerante a espacios y comillas, el error en el log por `SITE_URL` sin https, y el campo `firma` en `EventoWebhook`. Los tres salieron de los problemas de esta prueba.
- **Webhook sin verificar:** sin la clave real, no se pudo verificar ningún webhook firmado: el criterio "ningún `firma_invalida` de notificaciones reales" y el reenvío desde el panel quedan pendientes (ver abajo). Lo demás se verificó con la reconciliación.
- **"Copiar dirección":** Santiago confirmó WhatsApp, pero no pasó el texto copiado del #0010. Para ese pedido, según `textoEtiqueta()` del panel, son cuatro líneas: nombre y apellido; calle, número y piso/depto; `2900 San Nicolás de los Arroyos, Buenos Aires`; y `DNI 30123456 · Cel …`.
- **Compra 1:** se pidió Dino y se compró Conejito; no cambia nada de la prueba.

## Pendientes / problemas encontrados
- **Webhook (lo principal):** `MP_WEBHOOK_SECRET` tiene la clave **tapada** del panel (64 "•") en Vercel y en el `.env`. Falta que **Camilo pase la clave real** del modo prueba (Webhooks → Modo prueba → mostrar con el ojo). Con la clave:
  - [ ] pegarla en Vercel (`MP_WEBHOOK_SECRET`, Production) + Redeploy, y en el `.env`;
  - [ ] `/api/health` → `mpWebhook: "configurado"`;
  - [ ] **una compra más** (`APRO`, incógnito): en `eventowebhooks`, las notificaciones con `firmaValida: true`, una `procesado` y la otra `procesado` sin efecto (ya pagado); el stock baja una sola vez;
  - [ ] si el panel de Mercado Pago lo permite, **reenviar** la notificación de ese pago y verificar que no descuenta de nuevo;
  - [ ] ningún `firma_invalida`. Si siguiera habiendo, comparar el `firma` guardado con la clave (prueba vs productivo: los pagos llegan con `live_mode: true`).
- **Pago pendiente (`CONT`):** Mercado Pago lo dejó `in_process` y no lo resolvió en una hora. Qué llega cuando se resuelve (aprobado o rechazado) queda sin ver.
- **Vercel Hobby:** Santiago no encontró los logs de la función; en "Problemas comunes" está dónde verlos (Logs, o Deployments → el deploy → Logs). Para el webhook alcanza `eventowebhooks`.
- **Pedidos abandonados:** cada "Volver a intentar" o cada vuelta atrás desde Mercado Pago que pasa de nuevo por "Pagar" deja un `pendiente_pago`. No hacen daño; si molestan en el panel, se podría ocultar o cancelar solos los de más de 24 h. **A definir.**

## Cómo probarlo
Ver "Probar pagos en el deploy de Vercel (recomendado)" en `docs/DEPLOY.md`. Resumen:
1. `https://mundo-mickey.vercel.app/api/health` → `mp: "ok"` y `mpWebhook: "configurado"` (hoy da `"invalido"` hasta cargar la clave real).
2. Ventana de incógnito nueva, sin sesión de Mercado Pago. Comprar con un email inventado (`test_user_mmN@testuser.com`).
3. Pagar como invitado con Mastercard `5031 7557 3453 0604`, `11/30`, CVV `123`, DNI `12345678`; titular `APRO`, `OTHE` o `CONT`.
4. Revisar el pedido en `mundo-mickey-dev`, el stock en Sanity y `eventowebhooks`. Para ver la preferencia de un pedido (Git Bash, sin imprimir el token):
   ```bash
   curl -s https://api.mercadopago.com/checkout/preferences/<preferenciaId> \
     -H "Authorization: Bearer $(grep ^MP_ACCESS_TOKEN= .env | cut -d= -f2)"
   ```
5. Al terminar: `npm run pedidos:prueba -- --borrar`, vaciar `eventowebhooks` y `npm run seed`.
