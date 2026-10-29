# Avance 10 — Admin: pedidos

## Qué se hizo
- **Pedidos de prueba** (`scripts/pedidos-prueba.js`, `npm run pedidos:prueba`):
  - **se niega a correr si la base de `MONGODB_URI` no termina en `-dev`** (lo mira en la cadena antes de conectar, y otra vez en la base a la que se conectó);
  - crea 10 pedidos con datos inventados y los productos reales de Sanity (nombre, precio e `imagenUrl` de la portada), con números del `Counter` en orden de fecha:
    - 3 `pagado` (retiro, envío local y nacional), 2 `enviado` (uno con seguimiento de Andreani), 2 `entregado`, 2 `pendiente_pago` (uno de hace 30 h, con un pago rechazado) y 1 `cancelado`;
    - uno pagado con una nota de sobreventa en `notaInterna`, con el formato de `anotar()`, y uno con `notas` del comprador;
    - fechas repartidas en los últimos 10 días, con `historial`, `mp` y `stockDescontado` coherentes;
    - **no toca el stock**;
  - `-- --borrar` borra todos los pedidos y el contador, con la misma protección;
  - una línea en `DEPLOY.md` ("Pedidos de prueba").
- **Modelo `Pedido`:** `stockRepuesto: Boolean` (default `false`).
- **API** (`server/controllers/adminPedidos.js`, en `server/routes/admin.js` detrás de `requiereAdmin`):
  - `GET /api/admin/pedidos?estado=&q=&pagina=`: el filtro, la búsqueda, el orden, las páginas de 20 y la respuesta `{ pedidos, total, pagina, paginas, conteos }` del brief;
  - `GET /api/admin/pedidos/:id`: el pedido sin `__v`; 404 con id inexistente o inválido;
  - `PATCH /api/admin/pedidos/:id`: los cambios de estado permitidos (con historial), la devolución de stock al cancelar, el seguimiento y la nota, con 400 `{ error, campos }` y el pedido actualizado como respuesta.
- **Listado** (`/admin`, `ListaPedidos.tsx` + `.css`):
  - chips con conteo (A preparar, Enviados, Entregados, Pendientes de pago, Cancelados y Todos), deslizables en el celular, con el filtro en `?estado=`;
  - búsqueda con retardo de 350 ms, en `?q=`;
  - cada pedido es una tarjeta tocable: `#0007`, "hoy 14:32" / "ayer 09:10" / "23/10 18:05", nombre, total, entrega corta, cantidad de productos y la etiqueta de estado. Además, "⚠ Revisar" y "Link vencido" donde corresponde;
  - "← Anteriores" / "Siguientes →" con "Página N de M";
  - estados de cargando, error con "Reintentar" y vacío ("No hay pedidos para preparar." / "No encontramos pedidos con «…»").
- **Etiquetas de estado** (`EtiquetaEstado.tsx` + `.css`, las comparten listado y detalle): A preparar amarilla con borde negro; Enviado negra con texto blanco; Entregado blanca con borde negro y "✓"; Pendiente de pago con borde punteado; Cancelado y Rechazado atenuados y tachados.
- **Badge** en "Pedidos" de la barra (`AdminLayout`): los pedidos a preparar. Se pide al abrir el panel, se actualiza con el listado (sin búsqueda) y después de cada cambio de estado.
- **Detalle** (`/admin/pedidos/:id`, `DetallePedido.tsx`, `ContactoPedido.tsx` y `AccionesPedido.tsx`, cada uno con su CSS):
  - "← Pedidos" (vuelve al listado con su filtro y búsqueda), número, etiqueta y fecha;
  - alerta arriba de todo con las líneas de `notaInterna` que tienen "Revisar" o "Sobreventa";
  - **Comprador:** datos, celular formateado (`+54 9 336 412-3456`) y:
    - el selector de las 4 plantillas de WhatsApp, con la sugerida según estado y entrega y el texto editable;
    - **WhatsApp** (`wa.me/549…?text=`), **Email** (`mailto:` con el asunto y el saludo) y **Llamar** (`tel:+549…`);
  - **Entrega:** tipo, dirección, notas del comprador y "Copiar dirección" con el formato de etiqueta. Si el portapapeles falla, muestra el texto seleccionado;
  - **Productos:** miniatura (con el recuadro amarillo "★" si no carga), cantidad × precio, subtotal, envío ("A coordinar" en nacional) y total;
  - **Pago:** estado en castellano, id del pago con "Copiar" y el estado del stock (descontado, devuelto o sin descontar);
  - **Estado:** el botón principal según el estado, "Cambiar estado…", el diálogo de "Marcar como enviado" (con seguimiento y la oferta de WhatsApp) y el de "Cancelar pedido" (con "Devolver los productos al stock" marcado);
  - **Seguimiento** (con envío), **Nota interna** (con la ayuda del brief y contador) e **Historial**;
  - después de cada cambio: "Listo, se guardó." abajo y el pedido que devolvió la API. Errores debajo de cada campo y en una alerta, como en los formularios del panel;
  - cargando, error con "Reintentar" y "Este pedido no existe".
- **`ARQUITECTURA.md`:**
  - `stockRepuesto` en el modelo;
  - las tres filas de pedidos en "Endpoints";
  - "Flujo de pago" al día con el 09: `external_reference`, monto y moneda, transacción con `transactionId` por pedido, reconciliación con `?pago=`, `?source_news=webhooks`, notas en `notaInterna`, y un paso 6 con el panel;
  - las dos decisiones del brief;
  - en "Estructura de carpetas", `ListaPedidos`/`DetallePedido` en lugar de `TablaPedidos`, y `pedidos-prueba.js`.

## Archivos creados / modificados
- **Nuevos:**
  - `scripts/pedidos-prueba.js`;
  - `server/controllers/adminPedidos.js`;
  - `src/components/admin/ListaPedidos.tsx`/`.css`, `DetallePedido.tsx`/`.css`, `ContactoPedido.tsx`/`.css`, `AccionesPedido.tsx`/`.css`, `EtiquetaEstado.tsx`/`.css` y `contextoPanel.ts`;
  - `src/lib/pedidosAdmin.ts` (tipos, textos y helpers del listado y del detalle);
  - `docs/avances/10-admin-pedidos.md`.
- **Modificados:**
  - `server/models/Pedido.js` (`stockRepuesto`) y `server/routes/admin.js` (las tres rutas);
  - `src/pages/admin/AdminPedidos.tsx` y `AdminPedidoDetalle.tsx` (reemplazan los placeholders);
  - `src/components/admin/AdminLayout.tsx` y `.css` (badge, contexto del `Outlet` y piezas comunes);
  - `src/components/admin/FormProducto.tsx` y `.css` (ver "Desvíos");
  - `package.json` (script `pedidos:prueba`);
  - `docs/ARQUITECTURA.md` y `docs/DEPLOY.md` (solo lo indicado).

## Decisiones tomadas durante la implementación
- **Volver a `pagado` se permite solo desde `enviado` o `entregado`.** El brief pide "en cualquier dirección" entre los tres, y también "nunca a pagado desde el panel". Lo resolví así: corregir un pedido **ya cobrado** a "A preparar" está permitido. Un pedido sin cobrar (`pendiente_pago`, `cancelado`, `rechazado`) nunca pasa a `pagado` (400: "Un pedido pasa a «A preparar» (pagado) solo cuando Mercado Pago aprueba el pago."). Los demás rechazos dicen "No se puede pasar un pedido de «Entregado» a «Cancelado».".
- **El cambio de estado es atómico:** el update exige que el estado siga siendo el que se leyó. Si cambió en el medio (otra pestaña, o el webhook), responde **409** "El pedido cambió mientras lo mirabas…". Pedir el mismo estado que ya tiene no suma historial.
- **Devolución de stock:**
  - va con `setIfMissing({ stock: 0 })` + `inc` por producto (sumando las cantidades si un producto se repitiera), en una transacción con `transactionId` `reposicion-stock-<pedidoId>`, con `visibility: 'sync'`;
  - si Sanity responde "already exists", ya se había devuelto: no repite y marca `stockRepuesto`;
  - **se puede reintentar sobre un pedido ya cancelado** (`{ reponerStock: true }` sin `estado`), si se descontó y no se devolvió. Sirve si Sanity falló al cancelar, o si el dueño canceló sin devolver y cambió de idea. El detalle muestra "Devolver los productos al stock" en ese caso;
  - si Sanity falla, el pedido **queda cancelado**, se anota "Revisar: no se pudo devolver el stock…" y la API responde **502** con el error y el pedido. El panel muestra el pedido cancelado, el error y el botón para reintentar;
  - `reponerStock: true` sin terminar en `cancelado` → 400 en `reponerStock`. Con `stockDescontado: false` (un pendiente), se ignora.
- **Notas al cancelar** (`anotar()`): "Cancelado desde el panel: se devolvió el stock (Robot que camina +2, …).", "Cancelado desde el panel, sin devolver el stock." o "Cancelado desde el panel." (pendientes), y "Producto eliminado: …" si un producto ya no existe.
- **Búsqueda:**
  - **número:** `#0007` busca solo el número; `7` o `0007`, el número y también DNI y celular si tiene 4 dígitos o más;
  - **DNI y celular:** si el texto es solo dígitos y separadores de teléfono (`336 412-3456`), se busca por los dígitos;
  - **nombre:** con letras, cada palabra tiene que estar en el nombre o en el apellido ("ana perez" encuentra a Ana Pérez y no a Agustín Pérez). Las tildes se resuelven con una regex por letra (`nunez` → `n[uúùüû][nñ]…`), porque la collation de Mongo no sirve para regex;
  - **email:** por substring.
  
  Todo se escapa; un texto como `#abc` no trae nada. Límite de 100 caracteres.
- **`estado=cancelado,rechazado`:** el chip "Cancelados" junta los dos, así que la API acepta varios estados separados por coma (ver "Desvíos"). En la URL del front queda `?estado=cancelado`.
- **`revisar`** y la alerta del detalle usan la misma regla: `/revisar|sobreventa/i` en `notaInterna`.
- **URL:** "A preparar" es la URL sin `?estado=`. Los chips y la paginación agregan una entrada al historial; la búsqueda la reemplaza (si no, "atrás" recorrería cada palabra escrita). La página se borra al cambiar de chip o de búsqueda. "← Pedidos" usa el `search` que el listado pasa por el `state` del link; si el detalle se abre directo, vuelve a `/admin`.
- **Badge:** `AdminLayout` comparte `setAPreparar` y `refrescarAPreparar` por el contexto del `Outlet` (`contextoPanel.ts`), sin un contexto nuevo. Con una búsqueda activa, el listado no lo actualiza (los conteos vienen filtrados).
- **Mientras recarga** (cambio de chip, búsqueda o página), el listado deja los resultados anteriores atenuados (`aria-busy`) en lugar de vaciarlos. Las respuestas viejas se descartan.
- **Plantillas de WhatsApp:**
  - **sugerida:** `pagado` + retiro → "listo para retirar"; `pagado` + envío → "coordinar" (o "enviado" si ya tiene código); `enviado` → "enviado"; los demás → "libre";
  - si el dueño elige otra o edita el texto, se respeta. "Volver al texto de la plantilla" deshace la edición;
  - la opción no dice "(sugerido)" (se cortaba en el select a 375px): hay una ayuda debajo ("Es el sugerido para este pedido." o "Sugerido para este pedido: «…»");
  - dirección y horarios salen de `useConfiguracion()` (el CDN de la tienda). Los saltos de línea de los horarios pasan a " / ". Sin dirección, dice "en el local";
  - "Pedido enviado" con empresa "Otra" o sin empresa no dice "por …", y sin código no dice "Código de seguimiento".
  - El **Email** usa siempre el saludo libre, como pide el brief.
- **Celular legible:** el código de área sale de una lista de los de 2 dígitos (11) y de 3 dígitos. El resto se toma como de 4 (`+54 9 2477 41-2345`).
- **Botones del estado:** "Marcar como entregado" (retiro o enviado) se aplica directo, sin confirmación: si fue un error, se corrige con "Cambiar estado…". En "Cambiar estado…" no está "Cancelado", que tiene su propio diálogo. Un pendiente no tiene botón principal; muestra "Esperando el pago de Mercado Pago…".
- **"Marcar como enviado":** el seguimiento es opcional. Si se carga, va en el mismo `PATCH` que el estado. Al guardar, el diálogo pasa a "Listo, quedó como enviado" con "Abrir WhatsApp" (plantilla "Pedido enviado" con lo guardado) y "Ahora no".
- **Seguimiento:** un código sin empresa → 400 en `seguimiento.empresa` ("Elegí la empresa del envío."). Una empresa sin código es válida (por ejemplo, Vía Cargo sin número todavía).
- **Nota y seguimiento:** "Guardar" queda deshabilitado si no hay cambios. Los dos formularios se reinician con lo guardado (por `key`). Ojo: si se cancela un pedido mientras hay texto sin guardar en la nota, ese texto se pierde, porque la nota cambia con la línea automática.
- **Dos columnas desde 900px:** a la izquierda, comprador, entrega, seguimiento y nota; a la derecha, productos, pago, estado e historial. En el celular es una sola columna en el orden del brief (comprador, entrega, productos, pago, estado, seguimiento, nota, historial), con `display: contents` en las columnas y `order` en cada sección. Así el HTML es uno solo y el orden de lectura del celular no depende del de escritorio. Desde 900px, el listado va en dos tarjetas por fila.
- **Fechas** en la hora del navegador (el dueño está en Argentina): "hoy", "ayer", "dd/mm hh:mm" y el año solo si no es el actual. El historial usa "dd/mm/aaaa hh:mm".
- **El aviso "Listo, se guardó."** es una píldora amarilla fija abajo (`.adm-toast`) que se va a los 3,5 s, en una región `aria-live`. Así se ve aunque el cambio se haya hecho al fondo de la página en el celular.

## Desvíos respecto al brief
- **`estado` acepta varios valores separados por coma** (`cancelado,rechazado`), para el chip "Cancelados". El brief decía "uno de los del modelo, o `todos`". Está en "Endpoints".
- **Volver a `pagado` desde `enviado`/`entregado` está permitido** (ver "Decisiones"). Si preferís que el panel nunca escriba `pagado`, ni para corregir, es sacar `pagado` de `PERMITIDOS` y `CORRECCIONES`. **A definir.**
- **Piezas comunes en `AdminLayout.css`:** el estilo del `<dialog>` (`.fp__dialogo*`) vivía en `FormProducto.css`. Lo moví tal cual como `.adm-dialogo*` (son 3 clases en `FormProducto.tsx`), porque ahora lo usan también los diálogos de pedidos. También sumé `.adm-toast`, `.adm-oculto` (texto solo para lectores de pantalla) y el badge.
- **La barra del panel ahora mide 44px de alto en los links y en "Salir"** (antes, 41px). La prueba de objetivos táctiles la marcó, y venía así desde el 06b.
- **Subcomponentes con su propio CSS:** `ContactoPedido`, `AccionesPedido` y `EtiquetaEstado`, más `src/lib/pedidosAdmin.ts` y `contextoPanel.ts`, que el brief no nombraba.
- **API extra:** 409 si el estado cambió en el medio, y 502 si la devolución de stock falla (con el pedido).

## Pendientes / problemas encontrados
- **Sin Mercado Pago real** (igual que en el 08 y el 09): los pedidos son de prueba, y "Aprobado" y el id del pago son inventados.
- **La devolución de dinero sigue siendo manual** en Mercado Pago, como pide el brief. Si más adelante se quiere desde el panel, es la API de Refunds.
- **El badge no se actualiza solo** si entra un pedido mientras el panel está abierto. Se actualiza al entrar al listado o al cambiar un estado. Un refresco periódico sería fácil, pero no estaba pedido.
- **JS de la tienda:** 449,54 kB en HEAD → 450,11 kB (+0,57 kB), medido igual en los dos: el chunk de entrada más los que importa de forma estática. Vite reagrupó los chunks compartidos. En el de la tienda no aparecen `lpd__`, "Copiar dirección", "A preparar" ni `reposicion`. El panel de pedidos es su propio chunk: `AdminPedidos-*.js` (5,26 kB) y `AdminPedidoDetalle-*.js` (21,59 kB; 5,63 gzip).
- **El portapapeles de Windows devuelve el texto con `\r\n`** al leerlo. Lo que se copia lleva `\n`, y al pegarlo en una etiqueta o en WhatsApp queda igual.

## Cómo probarlo
```bash
cd "Mundo Mickey/mundo-mickey"
npm run pedidos:prueba          # 10 pedidos en mundo-mickey-dev
npm run dev                     # o dev:host para el celular
# al terminar:
npm run pedidos:prueba -- --borrar
```
Entrá a `/admin` (la contraseña de desarrollo está comentada en el `.env`).

**API con `curl`** (Git Bash; en PowerShell usá `curl.exe`):
```bash
API=http://localhost:4000/api
curl -i $API/admin/pedidos                                            # 401
TOKEN=$(curl -s -X POST $API/admin/login -H "Content-Type: application/json" \
  -d '{"usuario":"admin","password":"<contraseña>"}' | node -pe "JSON.parse(require('fs').readFileSync(0)).token")
AUTH="Authorization: Bearer $TOKEN"
curl -s "$API/admin/pedidos" -H "$AUTH"                               # pagado, con conteos
curl -s "$API/admin/pedidos?estado=todos&q=%230003" -H "$AUTH"        # #0003
curl -s "$API/admin/pedidos?estado=todos&q=nunez" -H "$AUTH"          # Núñez
curl -s "$API/admin/pedidos?estado=todos&q=30123456" -H "$AUTH"       # DNI
curl -s "$API/admin/pedidos?estado=todos&q=336%20412-3456" -H "$AUTH" # celular
ID=<_id de un pedido pagado>
curl -s -X PATCH $API/admin/pedidos/$ID -H "$AUTH" -H "Content-Type: application/json" -d '{"estado":"enviado"}'
curl -s -X PATCH $API/admin/pedidos/$ID -H "$AUTH" -H "Content-Type: application/json" -d '{"estado":"cancelado"}'   # 400
curl -s -X PATCH $API/admin/pedidos/$ID -H "$AUTH" -H "Content-Type: application/json" \
  -d '{"seguimiento":{"empresa":"DHL","codigo":"x"}}'                                                                  # 400 con campos
# Cancelar con devolución (en un pagado): sube el stock una sola vez
curl -s -X PATCH $API/admin/pedidos/$ID2 -H "$AUTH" -H "Content-Type: application/json" -d '{"estado":"cancelado","reponerStock":true}'
curl -s -X PATCH $API/admin/pedidos/$ID2 -H "$AUTH" -H "Content-Type: application/json" -d '{"reponerStock":true}'     # no repite
```
Después de cancelar con devolución, dejá el stock como el seed (`npm run seed` lo restaura).

**Verificado en esta sesión** (API con `node server/dev.js` en el 4000 y Vite en el 5174; scripts en el scratchpad de la sesión: `prueba-api.mjs`, `prueba-ui.mjs`, `reset.mjs` y `cdp.mjs`):

*Script:* con una `MONGODB_URI` que termina en `/mundo-mickey?…` → "✋ … no termina en "-dev"" y sale con código 1, sin conectar. En `mundo-mickey-dev` crea los 10 pedidos (`#0001` a `#0010`) y `--borrar` deja 0 pedidos y sin contador.

*API* (`prueba-api.mjs`, con `server/app.js` en el 4100; **59 chequeos, todos OK**):
- **Sin token:** listado, detalle y `PATCH` → 401.
- **Listado:**
  - sin `estado`, los 3 pagados (`#0009,#0008,#0006`, más nuevo primero), con `conteos` `{ pendiente_pago: 2, pagado: 3, enviado: 2, entregado: 2, rechazado: 0, cancelado: 1 }`;
  - la forma del resumen, `revisar` en el de sobreventa y `cantidad`;
  - `todos` → 10; `cancelado,rechazado` → 1; un estado inválido → 400 con `campos.estado`.
- **Búsqueda:**
  - `#0003`, `3` y `0007` → por número;
  - `nunez` → Núñez; `PEREZ` → 2; `ana perez` → 1; `lucia` → Lucía;
  - DNI, `336 412-3456` y parte del email;
  - `.*` → 0 (regex escapada);
  - `q=perez` → conteos solo de esos 2.
- **Paginación:** 25 pedidos extra → 20 + 5, `paginas: 2`.
- **Detalle:** el pedido sin `__v`, con `stockRepuesto: false`; 404 con id inexistente y con `abc`.
- **`PATCH` de estado:**
  - `pagado → enviado → entregado → enviado` con su historial (`pendiente_pago,pagado,enviado,entregado,enviado`); el mismo estado no suma historial;
  - `entregado → cancelado`, `pendiente_pago → pagado`, `pendiente_pago → enviado` y un estado inexistente → 400;
  - `entregado → pagado` → 200;
  - `cancelado → pagado` → 400.
- **Seguimiento y nota:**
  - seguimiento con espacios → recortado; vacío → se quita; empresa `DHL` y código de 41 → 400 con las dos claves; código sin empresa → 400;
  - nota con `\r\n` → `\n`; nota de 2001 → 400; nota vacía → se quita;
  - `reponerStock: "si"` → 400; `reponerStock` sin cancelar → 400.
- **Cancelar con devolución:**
  - stock +cantidad en Sanity, `stockRepuesto: true` y la nota;
  - repetirlo no repone;
  - con `stockRepuesto` vuelto a `false` a mano (como si se hubiera cortado después de la transacción), tampoco: Sanity rechaza el `transactionId`.
- **Cancelar un pendiente:** `stockRepuesto: false` y la nota "Cancelado desde el panel.". Un cuerpo que no es objeto → 400.

*Pantalla* (`prueba-ui.mjs`, Chrome headless por CDP; datos y stock reiniciados antes de cada ancho; **77 chequeos a 375px y 77 a 1280px, todos OK, sin errores de JavaScript**):
- **Listado:**
  - arranca en "A preparar" con los chips `A preparar 3|Enviados 2|Entregados 2|Pendientes de pago 2|Cancelados 1|Todos 10`;
  - 3 tarjetas en orden y badge 3;
  - la tarjeta del `#0006` con "Revisar", nombre, "Envío al país" y total; la del `#0009` con "hoy HH:MM" y "Retiro";
  - en "Todos", 5 estilos de etiqueta distintos (relleno, borde, color de texto, tachado y "✓");
  - "Link vencido" solo en el `#0007`; la etiqueta pendiente es punteada.
- **Búsqueda y URL:**
  - `nunez` → `?estado=todos&q=nunez`, una tarjeta, el conteo del chip filtrado y el badge sin cambios;
  - "← Pedidos" del detalle apunta a `/admin?estado=todos&q=nunez`;
  - `history.back()` vuelve con el chip "Todos", la búsqueda en el input y la tarjeta;
  - `zzzz` → "No encontramos pedidos con «zzzz».";
  - `?estado=cancelado` → `#0001`;
  - foco visible en un chip (contorno sólido de 3px);
  - con la API bloqueada: error y "Reintentar", que carga al desbloquear.
- **Detalle de un retiro (`#0009`):**
  - cabecera, sin alerta y `+54 9 336 477-6655`;
  - plantilla sugerida "retiro" y el link `wa.me/5493364776655?text=` con el texto exacto (dirección y horarios de la configuración);
  - el texto se edita y el link lo sigue;
  - `mailto:` con el asunto y el saludo, y `tel:+5493364776655`;
  - sin "Copiar dirección" ni seguimiento;
  - pago "Aprobado" y "Descontado"; "Copiar" del id del pago → el portapapeles tiene el id;
  - "Marcar como entregado" → "Entregado", "Listo, se guardó.", badge 3 → 2 y el historial;
  - "Cambiar estado…" → "A preparar" → badge 2 → 3.
- **Detalle de un envío local (`#0008`):**
  - las notas del comprador, "Envío $3.000" y la plantilla "coordinar" con el texto exacto;
  - "Copiar dirección" → la etiqueta exacta del brief;
  - con `clipboard.writeText` fallando → el texto aparece seleccionado;
  - "Marcar como enviado" → diálogo, Correo Argentino + `CA123456789AR` → "Listo, quedó como enviado" con el WhatsApp "Pedido enviado" exacto;
  - después: estado "Enviado", el seguimiento en el formulario, badge 2 y plantilla "enviado";
  - código de 41 (sin `maxlength`) → error debajo con `aria-invalid`; `CA999` → guardado en Mongo;
  - nota guardada.
- **`#0004` (enviado con Andreani):**
  - con una `imagenUrl` rota → el recuadro amarillo;
  - plantilla "enviado" con el código, "A coordinar" y sin "Cancelar".
- **`#0006` (sobreventa):**
  - la alerta arriba de la cabecera con "Sobreventa: … (pedido #0006, había 1)";
  - el diálogo de cancelar con el texto del brief y el checkbox marcado;
  - al confirmar: el stock de los 2 productos subió en Sanity, "Descontado y devuelto al cancelar", la nota, sin acciones de estado y badge 1.
- **Pendiente (`#0010`):** sin botón principal ni "Cambiar estado…", con "Cancelar pedido" sin checkbox; Escape cierra el diálogo; "Sin pago todavía".
- **Errores:** `000…0` y `abc` → "Este pedido no existe"; detalle con la API bloqueada → error y "Reintentar".
- **En todas:** sin scroll horizontal, ningún control de menos de 44px (también la barra) e inputs de 16px.

*Build:* `npm run build` sin errores. El panel sigue en chunks aparte (ver "Pendientes").

*Al terminar:* `npm run pedidos:prueba -- --borrar` (0 pedidos, sin contador). El stock como el seed (osito 3, dino 5, cohete 4, robot 2, conejo 6, pelota 8, todos activos). La configuración sin tocar (`_updatedAt` 2026-10-27, anterior a la sesión).

**Capturas** (fuera del repo), en `C:\Users\Admin\Proyectos\Mundo Mickey\capturas\10-admin-pedidos\`, a 375 y 1280px (`-375.png` / `-1280.png`):
- `listado-a-preparar` (chips y badge) y `listado-todos` (todas las etiquetas, página completa);
- `busqueda` ("nunez" en "Todos");
- `detalle-retiro` y `detalle-envio-seguimiento` (página completa; en este último, la miniatura de respaldo). En las de página completa a 375px, la barra `sticky` queda a mitad de la imagen;
- `dialogo-enviado` y `dialogo-cancelar`;
- `alerta-sobreventa`.
