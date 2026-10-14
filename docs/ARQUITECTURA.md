# Mundo Mickey — Arquitectura

## El negocio
Local de un amigo en San Nicolás de los Arroyos. Vende ropa de bebé, ropa infantil y juguetes. **La tienda web vende solo juguetes y peluches** de personajes y cosas en tendencia: 6 o 7 productos, con pocas unidades de cada uno.

El cliente elige y paga online con Mercado Pago. Después hay tres formas de entrega: retiro en el local, envío en San Nicolás o **envío a cualquier parte del país**. El dueño gestiona productos y pedidos desde su propio panel y contacta a los compradores para coordinar los envíos.

## Alcance de esta etapa
**Tienda (pública)**
- Home: hero, marquesina, catálogo, "Cómo comprar" y footer, basados en la maqueta `docs/referencia/maqueta.html`.
- Detalle de producto con galería de fotos (`/producto/:slug`).
- Carrito en drawer lateral, con límite por stock disponible.
- Checkout:
  - datos del comprador (nombre, apellido, DNI, celular y email);
  - forma de entrega;
  - dirección completa si hay envío.
  - Después, pago con **Mercado Pago Checkout Pro**.
- Webhook de Mercado Pago: cuando el pago se aprueba, el pedido pasa a "pagado" y se descuenta el stock.
- Páginas de resultado del pago: éxito, error y pendiente.

**Panel `/admin`** (con login)
- **Pedidos:**
  - listado filtrable por estado y con búsqueda por nombre o número;
  - detalle con todos los datos del comprador y de la entrega;
  - botones **WhatsApp** (abre el chat con un mensaje armado que incluye el número de pedido), **Email** y **Copiar dirección** (para la etiqueta del envío);
  - cambio de estado, número de seguimiento del envío y una nota interna.
- **Productos:** crear, editar, ocultar y eliminar. Cada producto tiene nombre, descripción, precio, stock, fotos (subida desde el celular, con reordenamiento y elección de portada), badge, destacado y orden.
- **Configuración:** datos del local (dirección, horarios, WhatsApp e Instagram), opciones de envío y textos de la marquesina.

**Excluido (para más adelante)**
- Ropa y talles.
- Cuentas de usuario.
- Cupones y promos.
- Cotización automática de envíos (Mercado Envíos, Andreani o Correo).
- Emails automáticos al cliente.
- Facturación.
- Varios usuarios en el admin.

## Envíos
| Opción | Costo | Cómo se cobra |
|---|---|---|
| Retiro en el local | gratis | — |
| Envío en San Nicolás | fijo, configurable desde el panel | se suma al pago de MP como ítem "Envío" |
| Envío al resto del país | se coordina por WhatsApp | **no se cobra en la web**; el comprador lo paga aparte o en destino (pago en destino del correo) |

Cada opción se puede activar o desactivar desde Configuración. El texto que explica la opción nacional también se edita desde ahí.

## Stack y deploy
- **Un solo proyecto en Vercel.** El front es una SPA de Vite y la API es Express corriendo como una única **Vercel Function** en `api/index.js`. Se despliega todo junto con un push y queda en el mismo dominio, sin CORS.
- **Front:** React + TypeScript + Vite, react-router-dom y CSS propio sin librerías de UI.
- **API:** Express en JavaScript con ES modules, dentro de `server/`. La app se exporta **sin `app.listen`**: en Vercel la levanta `api/index.js` y en local la levanta `server/dev.js`.
- **Sanity:** productos, imágenes (con su CDN y transformaciones) y configuración del local.
  - **No se usa Sanity Studio:** todo se carga desde `/admin`.
  - El front lee directo del dataset público.
  - Todas las escrituras pasan por la API, con el token de escritura.
- **MongoDB Atlas (M0):** pedidos, contador de número de pedido y log de webhooks. El cluster va en **AWS N. Virginia (us-east-1)**, la misma región por defecto de las funciones de Vercel.
- **Mercado Pago:** Checkout Pro vía Preferences API, con el SDK `mercadopago` para Node.
- **Local:** `npm run dev` levanta Vite en el puerto 5173 y la API en el 4000. Vite hace proxy de `/api` al 4000, así el front siempre llama a `/api/...` tanto en local como en producción.

## Modelos de datos

### Sanity: `producto`
| Campo | Tipo | Notas |
|---|---|---|
| nombre | string | requerido |
| slug | slug | generado desde `nombre`, único |
| descripcion | text | corta, 1 o 2 líneas |
| precio | number | ARS, entero, requerido |
| stock | number | entero, mínimo 0 |
| imagenes | array de image | mínimo 1; la primera es la portada |
| badge | string | opcional, por ejemplo "Nuevo" o "Últimas unidades" |
| destacado | boolean | solo uno a la vez; al marcar uno se desmarca el anterior |
| activo | boolean | `false` lo oculta de la tienda sin borrarlo |
| orden | number | orden en la grilla |

### Sanity: `configuracion` (documento único, `_id: "configuracion"`)
- `whatsapp`, `instagram`, `direccion`, `horarios`
- `envioLocal`: `{ habilitado: boolean, costo: number, texto: string }`
- `envioNacional`: `{ habilitado: boolean, texto: string }`
- `marquesina`: array de strings

### Mongo: `Pedido`
```
numero: Number (incremental: #0001)
cliente: { nombre, apellido, dni, celular, email }
entrega: {
  tipo: 'retiro' | 'envio_local' | 'envio_nacional',
  direccion?: { calle, numero, pisoDepto?, localidad, provincia, codigoPostal },
  notas?
}
items: [{ productoId, nombre, precioUnitario, cantidad, imagenUrl }]
subtotal, costoEnvio, total: Number
estado: 'pendiente_pago' | 'pagado' | 'enviado' | 'entregado' | 'rechazado' | 'cancelado'
seguimiento?: { empresa, codigo }
notaInterna?: String
mp: { preferenciaId, pagoId, estadoPago, detalle }
stockDescontado: Boolean (idempotencia del webhook)
historial: [{ estado, fecha }]
createdAt, updatedAt
```
Los ítems guardan nombre, precio e imagen **al momento de la compra**, así el pedido no cambia si después se edita o se borra el producto.

### Mongo: `Counter`
`{ _id: 'pedido', seq: Number }` para generar `numero`.

### Mongo: `EventoWebhook`
Guarda cada notificación de MP recibida y el resultado de procesarla. Sirve para debug, porque en Vercel Hobby los logs duran 1 hora.

## Flujo de pago
1. El front manda `POST /api/pagos/checkout` con `{ items: [{ id, cantidad }], cliente, entrega }`, **sin precios**.
2. La API lee precio y stock reales de Sanity, valida y calcula el costo de envío según la configuración: `envio_local` suma el costo fijo y `envio_nacional` suma 0. Crea el `Pedido` en estado `pendiente_pago` y crea la preferencia en MP:
   - `external_reference` = `_id` del pedido;
   - `payer` con nombre y email;
   - el envío local va como ítem "Envío";
   - lleva `back_urls`, `auto_return: approved` y `notification_url` armadas con `SITE_URL`.
3. La API devuelve `init_point` y el front redirige.
4. MP avisa por `POST /api/pagos/webhook`. La API:
   - valida la firma `x-signature`;
   - consulta el pago;
   - si está `approved`, hace un update atómico del pedido de `pendiente_pago` a `pagado` y descuenta el stock en Sanity;
   - **recién después responde 200.** En serverless no se puede responder primero y seguir procesando. Si algo falla, responde 500 para que MP reintente.
   - Si el pedido ya estaba pagado, no hace nada y responde 200.
5. La página `/pago/exito` consulta `GET /api/pedidos/:id/estado` para mostrar el estado real. Si el envío es nacional, aclara que lo van a contactar por WhatsApp para coordinarlo. **La vuelta del cliente a esa página no confirma nada.**

## Subida de imágenes
- Vercel corta los requests de más de **4,5 MB**, y las fotos del celular suelen pasarlo. Por eso **el navegador achica cada foto antes de subirla**: con un canvas la lleva a 1600px de lado mayor y la convierte a JPEG o WebP con calidad de alrededor de 0,85. Queda en unos cientos de KB.
- Se sube **una imagen por request** a `POST /api/admin/imagenes` (multipart, con `multer` en memoria). La API la sube a Sanity con `client.assets.upload` y devuelve el `_id` del asset y su URL.
- El formulario del producto guarda las referencias a esos assets, en el orden que eligió el dueño.

## Endpoints
**Públicos**
| Método | Ruta | Uso |
|---|---|---|
| GET | `/api/health` | estado de la API y de la DB |
| POST | `/api/pagos/checkout` | crea el pedido y la preferencia |
| POST | `/api/pagos/webhook` | notificaciones de MP |
| GET | `/api/pedidos/:id/estado` | estado público mínimo (número, estado y tipo de entrega) |

**Admin** (requieren JWT, salvo el login)
| Método | Ruta | Uso |
|---|---|---|
| POST | `/api/admin/login` | devuelve JWT (12 horas) |
| GET | `/api/admin/pedidos?estado=&q=` | listado |
| GET | `/api/admin/pedidos/:id` | detalle completo |
| PATCH | `/api/admin/pedidos/:id` | estado, seguimiento y nota interna |
| GET | `/api/admin/productos` | todos, también los ocultos (lectura sin CDN) |
| POST | `/api/admin/productos` | crear |
| PUT | `/api/admin/productos/:id` | editar |
| DELETE | `/api/admin/productos/:id` | eliminar |
| POST | `/api/admin/imagenes` | subir 1 imagen a Sanity |
| GET / PUT | `/api/admin/configuracion` | leer y guardar la configuración |

## Rutas del front
**Tienda:** `/` · `/producto/:slug` · `/checkout` · `/pago/:resultado` (exito, error o pendiente) · `*` (NotFound)

**Panel:** `/admin/login` y, dentro de `AdminLayout`:
- `/admin` → pedidos
- `/admin/pedidos/:id`
- `/admin/productos`
- `/admin/productos/nuevo`
- `/admin/productos/:id`
- `/admin/configuracion`

## Estructura de carpetas
```
mundo-mickey/
├── api/
│   └── index.js          (entrada de la Vercel Function: importa la app de server/ y la exporta)
├── server/
│   ├── app.js            (Express: middlewares + rutas; export default, SIN listen)
│   ├── dev.js            (solo local: carga .env y hace app.listen(4000))
│   ├── config/           (env.js, db.js)
│   ├── lib/              (sanity.js, mercadopago.js)
│   ├── models/           (Pedido.js, Counter.js, EventoWebhook.js)
│   ├── routes/
│   ├── controllers/
│   └── middlewares/      (auth.js, errores.js, subida.js)
├── src/                  (front React)
│   ├── components/
│   │   ├── layout/   (Header, Footer, Layout)
│   │   ├── home/     (Hero, Marquesina, ComoComprar)
│   │   ├── catalogo/ (Grilla, CardProducto)
│   │   ├── producto/
│   │   ├── carrito/  (CarritoDrawer, ItemCarrito)
│   │   ├── checkout/
│   │   ├── pago/
│   │   └── admin/    (AdminLayout, TablaPedidos, FormProducto, SubidorImagenes, ...)
│   ├── pages/
│   │   └── admin/
│   ├── context/      (CarritoContext, AuthAdminContext)
│   ├── lib/          (api.ts, sanity.ts, formato.ts, imagenes.ts)
│   ├── types/
│   ├── styles/       (tokens.css, base.css)
│   ├── App.tsx
│   └── main.tsx
├── public/               (logo.png, favicon)
├── docs/
│   ├── ARQUITECTURA.md
│   ├── DEPLOY.md
│   ├── avances/
│   └── referencia/ (maqueta.html, logo.png)
├── scripts/              (seed.js: carga productos de prueba; limpiar-seed.js: los borra)
├── index.html
├── vite.config.ts
├── vercel.json
├── package.json          (uno solo para front y API)
└── .env.example
```
Cada componente lleva su CSS al lado: `Header.tsx` con `Header.css`.

## Diseño
**Tienda**
- **Colores:** únicamente amarillo `#FFDD00`, negro `#000000` y blanco `#FFFFFF`, más transparencias de negro y blanco para textos secundarios. No hay ningún otro color.
- **Tipografía:** Bricolage Grotesque 400, 600 y 800, desde Google Fonts.
- **Radio:** 22px en cards y 999px en botones. Easing `cubic-bezier(.2,.8,.2,1)`.
- **Animaciones:**
  - título del hero entrando línea por línea;
  - órbita girando y peluche flotando;
  - marquesina;
  - lift de las cards en hover;
  - estrella que vuela al carrito.
  - Todo respeta `prefers-reduced-motion`.
- **Foco visible:** contorno negro sobre fondos claros y amarillo sobre fondos negros.
- **Sin modo oscuro:** la marca es fija.
- Mobile first: 375px sin scroll horizontal.

**Panel:** misma tipografía y colores, pero sobrio y funcional, sin animaciones decorativas. Tiene que funcionar bien **en el celular**, porque el dueño lo va a usar desde ahí. Los estados de los pedidos se distinguen con etiquetas que usan solo negro, blanco y amarillo, variando relleno, borde y texto.

## Decisiones tomadas
- **API serverless en Vercel en vez de un server en Render.** El deploy es uno solo, todo queda en el mismo dominio sin CORS, no hay que pagar un server aparte, y Fluid compute evita los arranques en frío largos que complicaban el webhook de MP.
- **Express adentro de una función, no un handler por endpoint:** mantiene la forma de trabajar de siempre (rutas, middlewares, controllers). Si mañana hay que mudarlo a un server, `server/` funciona igual con `dev.js`.
- **Conexión a Mongo cacheada en `globalThis`**, para reutilizarla entre invocaciones y no abrir una conexión por request.
- **El webhook procesa todo y recién después responde**, porque en serverless no hay garantía de ejecutar nada después de la respuesta.
- **Productos desde el panel propio y no desde Sanity Studio:** el dueño carga todo en el mismo lugar donde ve los pedidos, con una interfaz simple y en español. Sanity queda como base de datos y CDN de imágenes.
- **Las imágenes se comprimen en el navegador** y se sube una por request, por el límite de 4,5 MB de Vercel.
- **Pedidos en MongoDB y no en Sanity:** los pedidos son datos transaccionales con datos personales. El dataset de Sanity es público, y cualquier documento ahí se puede leer por GROQ.
- **El envío nacional no se cotiza en la web:** se coordina por WhatsApp y se paga aparte o en destino. Integrar un cotizador (Mercado Envíos, Andreani o Correo) queda para otra etapa.
- **Se pide DNI al comprador** porque los correos lo exigen para despachar.
- **Contacto con el comprador desde el panel con links `wa.me` y `mailto`**, sin integración de mensajería.
- **Checkout Pro vía Preferences:** tiene SDK completo en Node y mucha más documentación que la vía Orders.
- **El webhook es la única fuente de verdad del pago.** Las `back_urls` solo muestran un mensaje.
- **El stock se descuenta recién al aprobarse el pago**, no al crear el pedido. Con este volumen, el riesgo de sobreventa simultánea es mínimo, y si pasa se devuelve desde MP.
- **Un solo usuario admin**, con credenciales en variables de entorno (`ADMIN_USER` y `ADMIN_PASSWORD_HASH` con bcrypt) y JWT.
- **Regla de variables de entorno:** solo lo que empieza con `VITE_` llega al navegador. Los secretos (tokens, claves, JWT) **nunca** llevan ese prefijo.

## Pendientes / a definir con el cliente
- **Plan de Vercel:** Hobby es solo para uso personal y no comercial, y una tienda es comercial. Corresponde Pro (USD 20 por mes por usuario). Definir si la cuenta y el costo quedan a nombre del cliente.
- **Envío nacional:** confirmar que se coordina aparte y con qué correo trabaja. Si prefiere cobrarlo en la web, hay que definir tarifas por zona.
- Costo del envío en San Nicolás.
- Datos del local: dirección, horarios, WhatsApp e Instagram.
- Cuenta de Mercado Pago del amigo, con la aplicación creada y las credenciales de prueba y de producción.
- Fotos reales de los 6 o 7 productos, con precio y stock (las puede cargar él desde el panel).
- Dominio, y la decisión sobre el nombre de la marca en lo digital.
- Usuario y contraseña del admin.