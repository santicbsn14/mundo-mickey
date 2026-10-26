# Avance 07 — Admin: configuración del local

## Qué se hizo
- **Campo nuevo `mapaUrl`** (string, opcional): el link de Google Maps del local. Está en el tipo `Configuracion`, en la query de `obtenerConfiguracion()`, en el seed (`mapaUrl: ""`) y en "Modelos de datos".
- **API** (`server/controllers/adminConfiguracion.js`, dentro de `/api/admin` y con `requiereAdmin`):
  - `GET /api/admin/configuracion`: lee con `sanityLectura()` (sin CDN) y devuelve todos los campos del modelo. Si el documento no existe, devuelve los valores por defecto **sin crearlo**. Si existe pero le falta un campo (como `mapaUrl` en la configuración actual), lo completa con su valor por defecto;
  - `PUT /api/admin/configuracion`: valida, guarda con `createOrReplace` (`_id` y `_type` `"configuracion"`) y responde con la configuración guardada, leída de nuevo. Arma el documento solo con los campos del modelo: lo demás (incluidos `_id` o `extra`) se ignora;
  - validación con 400 `{ error: "Revisá los datos de la configuración.", campos }`, con las reglas y las claves del brief (`"envioLocal.costo"`, `"marquesina.2"`…). Los textos se guardan sin espacios al principio ni al final, y en los horarios los `\r\n` pasan a `\n`.
- **Pantalla `/admin/configuracion`** (`FormConfiguracion.tsx` + `.css`):
  - estados de cargando, error con "Reintentar" y el formulario;
  - tres secciones con su título: **Datos del local**, **Envíos** y **Marquesina**, con los campos, ayudas e interruptores del brief;
  - WhatsApp con el prefijo fijo "+54 9", `inputmode="tel"` y "Probar el link ↗" cuando el número tiene el largo correcto. Instagram con el prefijo "@", que acepta `@usuario`, `usuario` o un link;
  - costo del envío como el precio de productos (`3000` o `3.000`, con `pesos()` debajo, y "Gratis" si es 0);
  - marquesina: filas con "▲", "▼" y "Quitar", "Agregar texto" (hasta 10), contador "N/40" y una vista previa estática;
  - el mismo patrón del formulario de productos: errores de la API debajo de cada campo con `aria-invalid`, alerta general en la barra fija de "Guardar", foco al primer error, "Guardar" deshabilitado mientras guarda y `beforeunload` con cambios sin guardar;
  - al guardar: el aviso "Listo, se guardó la configuración. Puede tardar un par de minutos en verse en la tienda." arriba, con el foco. El formulario queda abierto con lo que devolvió la API.
- **"Visitanos"**: "Cómo llegar" usa `mapaUrl` si existe y, si no, la búsqueda por dirección. El `iframe` sigue usando la búsqueda. Con `mapaUrl` y sin dirección, aparece "Cómo llegar" pero no el mapa. **Sin mapa, la sección pasa a una sola columna en desktop.**
- **`AVISO_CDN`** ahora dice "Puede tardar un par de minutos en verse en la tienda.". Ya era el único lugar con ese texto: el formulario y el listado de productos lo usan.
- **`ARQUITECTURA.md`**: `mapaUrl` en el modelo, "el retiro en el local está siempre disponible" en "Envíos" y la decisión del formato del WhatsApp. La fila `GET / PUT /api/admin/configuracion` ya estaba con esa forma y no la toqué.

## Archivos creados / modificados
- **Nuevos:**
  - `server/controllers/adminConfiguracion.js`;
  - `src/components/admin/FormConfiguracion.tsx` y `FormConfiguracion.css`;
  - `docs/avances/07-admin-configuracion.md`.
- **Modificados:**
  - `server/routes/admin.js`: las dos rutas;
  - `src/pages/admin/AdminConfiguracion.tsx`: monta el formulario, en lugar del placeholder;
  - `src/types/configuracion.ts` y `src/lib/queries.ts`: `mapaUrl`;
  - `src/components/home/Visitanos.tsx` y `.css`;
  - `src/lib/productosAdmin.ts`: `AVISO_CDN`;
  - `scripts/seed.js`: `mapaUrl: ''` en los valores por defecto;
  - `docs/ARQUITECTURA.md`: solo lo indicado;
  - `src/components/admin/AdminLayout.css`, `FormProducto.css` y `FormProducto.tsx`: ver "Desvíos".

## Decisiones tomadas durante la implementación
- **Validación en el controller**, sin un `server/lib/configuracion.js` aparte: no la usa nadie más (el checkout del 08 solo lee).
- **Si el `PUT` no trae algo, toma un valor por defecto.** Un texto ausente o `null` pasa a ser `""`, y la marquesina, `[]`. Lo que es obligatorio: `envioLocal.habilitado`, `envioNacional.habilitado` (booleanos) y `envioLocal.costo` (entero). Es el mismo criterio que `activo` en productos: no se puede prender o apagar un envío sin querer.
- **Errores de la marquesina por posición en lo que se mandó.** El panel manda todas las filas, también las vacías. La API descarta las vacías, pero el error de cada texto usa su posición original (`marquesina.N`), así cae en la fila correcta aunque haya vacías en el medio. El límite de 10 cuenta también los textos con error: con 11 textos y uno de 41 caracteres, salen los dos errores (`marquesina` y `marquesina.2`).
- **`mapaUrl`:** además de `https` y del dominio, se mira el camino. En `google.com` y `www.google.com` tiene que empezar con `/maps`, y en `goo.gl`, con `/maps/`. `maps.google.com` y `maps.app.goo.gl` aceptan cualquier camino. Se rechazan `google.com.evil.com`, `http://`, `/mapsx` y las URLs con usuario y contraseña. Hasta 500 caracteres.
- **WhatsApp en el panel:**
  - al cargar, se le saca el `549`. Al guardar, se mandan `"549"` + los dígitos (sin dígitos, `""`);
  - **si pegan el número completo** (`+54 9 0336 412-3456`, `549…`, `54…` o con el 0 del área), al salir del campo queda solo lo de después del +54 9. Ningún código de área de Argentina empieza con 5 ni con 0, así que no se rompe un número bien escrito. Si lo escribieron con su formato (`336 412-3456`), se deja como está;
  - el input solo acepta dígitos, espacios, `+`, `-` y paréntesis;
  - "Probar el link" usa la misma regla que la API (`549` + 9 o 10 dígitos).
- **Instagram:** reconoce links con o sin `https://`, con `www.` o `m.`, y con `?igsh=…` al final.
- **Prefijos accesibles:** "+54 9" y "@" se ven pegados al input, pero son `aria-hidden`. El `label` suma un texto solo para lectores de pantalla (", después del +54 9" y ", el usuario sin la @").
- **Un envío apagado oculta sus campos, salvo que tengan un error.** Si el costo queda vacío y se apaga el envío, la API igual lo rechaza (el costo se guarda siempre). En ese caso los campos se muestran con el error y el foco, para que no quede un error escondido.
- **Mover, agregar o quitar filas de la marquesina borra sus errores**, porque cambian las posiciones. Editar un texto borra solo el error de esa fila.
- **"Agregar texto" lleva el foco al input nuevo.**
- **Vista previa:** los textos van en varias líneas si no entran (en el celular, uno por línea), con la misma letra, el mismo padding y la "★" de la tienda, pero **solo entre textos**. Así se ven todos de una vez. Las filas vacías no se muestran.
- **Marquesina en 375px:** la etiqueta "Texto N" y el contador arriba, el input y, debajo, "▲", "▼" y "Quitar". Desde 600px, los botones van en la misma fila que el input.
- **"Cambios sin guardar"** compara lo que se mandaría (no lo que hay escrito): `3.000` contra `3000`, o `@mundomickey` contra `mundomickey`, no cuentan como cambio. Después de guardar, la referencia pasa a ser lo guardado.
- **Envíos en recuadros** con borde suave. El retiro va como una línea informativa ("Siempre disponible y gratis."), sin controles. Al interruptor del envío local le sumé la aclaración "Con un costo fijo, que se suma al pago."; el del nacional usa la ayuda del brief.
- **"Visitanos":** `mapaUrl` se usa solo si empieza con `https://`, como control extra del lado de la tienda. "Una columna" depende de si hay mapa (`direccion`), no de si hay "Cómo llegar". Mientras carga, se reserva el lugar del mapa como antes.

## Desvíos respecto al brief
- **Piezas del formulario movidas a `AdminLayout.css`:** `.campo*`, el interruptor (`.interruptor*`) y la barra fija de "Guardar" estaban en `FormProducto.css`, que solo se carga con el formulario de productos. Las moví tal cual a las piezas comunes, y renombré la barra: `.fp__barra` → `.adm-barra-guardar` y `.fp__guardar` → `.adm-guardar` (2 clases en `FormProducto.tsx`). El formulario de productos quedó igual: lo revisé a 375px (inputs de 48px, barra `sticky`, interruptor y stock iguales, sin controles chicos ni scroll horizontal).
- **El chunk de la tienda cambió de forma, no de tamaño.** Vite volvió a agrupar las dependencias compartidas: React Router quedó en `index-*.js` y el chunk compartido (`react-*.js`) tiene solo React. El JS que carga la tienda pasó de 425,86 kB (HEAD) a 426,12 kB (+0,26 kB, por los cambios de `Visitanos`). Busqué `fc__`, "Probar el link", "Agregar texto", `adm-barra-guardar` e `interruptor` en `index-*.js`: 0 apariciones. El panel de configuración es su propio chunk: `AdminConfiguracion-*.js`, de 15,29 kB (4,32 gzip), más 2,03 kB de CSS.

## Pendientes / problemas encontrados
- **El detalle del producto muestra "$0" si el costo del envío local es 0.** `EntregaProducto` usa `pesos(costo)`. El panel dice "Gratis", pero el brief no dejaba tocar otras partes de la tienda. Propuesta para el 08 (que de todos modos toca la entrega en el checkout): mostrar "Gratis" con costo 0. **A definir.**
- **Navegar a otra sección del panel con cambios sin guardar no pregunta.** Solo `beforeunload` (recargar o cerrar), como pide el brief. Para avisar al tocar "Productos" o "Pedidos" haría falta un bloqueo del router (`useBlocker` necesita el data router, y hoy se usa `BrowserRouter`). **A definir** si vale la pena.
- **El CDN de Sanity:** en estas pruebas, los cambios tardaron entre 1 y 114 s en llegar al API CDN. Las queries distintas tienen caché por separado: la de la tienda tardó más que mi consulta de prueba, que ya mostraba el dato nuevo. El aviso nuevo ("un par de minutos") cubre lo que vi.
- **El texto del envío nacional del seed ocupa 3 líneas a 375px** en la textarea de 2 filas que pide el brief. Se puede estirar (`resize: vertical`).
- **Mongo de desarrollo** sigue sin conectar (IP no habilitada en Atlas). No afecta a este brief.

## Cómo probarlo
```bash
cd "Mundo Mickey/mundo-mickey"
npm run dev            # o npm run dev:host para el celular
```
Entrá a `/admin/login` (la contraseña de desarrollo está comentada en el `.env`) y andá a **Configuración**.

- **Carga:** WhatsApp sin el 549 (`3360000000`) e Instagram sin @.
- **WhatsApp:** escribí `336 412-3456` → "Probar el link ↗" abre `wa.me/5493364123456`. Pegá `+54 9 0336 412-3456` y salí del campo → `3364123456`.
- **Instagram:** pegá `https://www.instagram.com/mundomickey/` y salí del campo → `mundomickey`.
- **Envíos:** apagá "Envío en San Nicolás" (se ocultan costo y texto) y guardá. Al rato, el detalle de un producto no lo muestra. Prendelo: vuelven el costo y el texto. Costo `0` → "En la tienda: Gratis".
- **Marquesina:** agregá, mové, quitá y editá textos; la vista previa acompaña. Con 10, "Agregar texto" se deshabilita.
- **Errores:** WhatsApp `12345` → error debajo, con el foco ahí.
- **Sin guardar:** cambiá algo y recargá → pide confirmación.
- **Al terminar:** volvé la configuración a como estaba (`npm run seed` no la restaura).

**API con `curl`** (en Git Bash; en PowerShell usá `curl.exe` y cambiá las comillas):
```bash
API=http://localhost:4000/api
curl -i $API/admin/configuracion                                   # 401
curl -i -X PUT $API/admin/configuracion                            # 401

TOKEN=$(curl -s -X POST $API/admin/login -H "Content-Type: application/json" \
  -d '{"usuario":"admin","password":"<contraseña>"}' | node -pe "JSON.parse(require('fs').readFileSync(0)).token")
AUTH="Authorization: Bearer $TOKEN"

# Guardá la configuración actual para restaurarla después
curl -s $API/admin/configuracion -H "$AUTH" > config-antes.json

# Válido (el campo "extra" no se guarda)
curl -s -X PUT $API/admin/configuracion -H "$AUTH" -H "Content-Type: application/json" -d '{
  "whatsapp":"5493364123456","instagram":"mundomickey","direccion":"Av. Savio 123","horarios":"Lunes a viernes 9 a 13",
  "mapaUrl":"https://maps.app.goo.gl/abc","envioLocal":{"habilitado":true,"costo":3000,"texto":"Solo San Nicolás"},
  "envioNacional":{"habilitado":true,"texto":"Por WhatsApp."},"marquesina":["Peluches","Juguetes"],"extra":"x"}'

# Inválido → 400 con whatsapp, instagram, mapaUrl, envioLocal.costo, marquesina y marquesina.2
curl -s -X PUT $API/admin/configuracion -H "$AUTH" -H "Content-Type: application/json" -d '{
  "whatsapp":"12345","instagram":"mundo mickey","mapaUrl":"https://www.ejemplo.com/maps/x",
  "envioLocal":{"habilitado":true,"costo":-1,"texto":""},"envioNacional":{"habilitado":false,"texto":""},
  "marquesina":["1","2","xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx","4","5","6","7","8","9","10","11"]}'

# Restaurar (si la configuración original no tenía mapaUrl, el PUT le suma "mapaUrl": "", que es equivalente)
curl -s -X PUT $API/admin/configuracion -H "$AUTH" -H "Content-Type: application/json" -d @config-antes.json
```

**Verificado en esta sesión** (API propia con `node server/dev.js` en el 4000 y Vite en el 5174; Chrome headless por CDP con scripts en el scratchpad de la sesión):

*API* (script con `fetch`, 47 chequeos, todos OK):
- Sin token, `GET` y `PUT` → 401.
- `GET` → la configuración del seed, con `mapaUrl: ""` agregado.
- `PUT` válido → 200. Textos sin espacios, `\r\n` → `\n`, marquesina sin vacíos (`[" Peluches ", "", "   ", "Juguetes"]` → `["Peluches","Juguetes"]`) y el envío apagado conserva costo y texto. En Sanity, sin `extra`, con `_type: "configuracion"` y sin crear un documento `"otro"` (por el `_id` del cuerpo).
- `mapaUrl` aceptados: `maps.app.goo.gl/…`, `www.google.com/maps/place/…`, `google.com/maps?q=…`, `maps.google.com/?q=…` y `goo.gl/maps/…`.
- El inválido del brief → 400 con las 6 claves: `whatsapp`, `instagram`, `mapaUrl`, `envioLocal.costo`, `marquesina` y `marquesina.2`.
- 19 casos más, cada uno con una sola clave de error: WhatsApp con espacios, de 14 dígitos o sin 549; Instagram con @ o de 31 caracteres; `mapaUrl` con `http`, `google.com/search`, `google.com.evil.com` y `/mapsx`; dirección de 121, horarios de 301; costo decimal, en texto o de 1.000.001; textos de los envíos de 121 y 201; `habilitado` no booleano; marquesina que no es lista o con un número.
- Límites → 200: 12 dígitos, costo 1.000.000 y 10 textos de 40 (más 2 vacíos). Lo mínimo (solo los booleanos y el costo) → 200 con todo vacío. Un cuerpo que no es objeto → 400.
- **Documento borrado:** `GET` → los valores por defecto del brief, y el documento sigue sin existir. Después lo restauré con un `createOrReplace` del backup.

*Pantalla a 375px* (54 chequeos, todos OK):
- Con `/api/admin/configuracion` bloqueado: "No se pudo conectar…" y "Reintentar". Al desbloquear, "Reintentar" carga el formulario.
- Carga: `3360000000`, `mundomickey`, `3.000`, las 5 filas de la marquesina con su vista previa, los prefijos "+54 9" y "@" y el retiro sin controles.
- Sin scroll horizontal, ningún control de menos de 44px, inputs de 16px y `inputmode="tel"`.
- WhatsApp, Instagram y costo: todos los casos de "Cómo probarlo", más `@mundo.mickey` → `mundo.mickey` e `instagram.com/mundomickey?igsh=abc` → `mundomickey`.
- Interruptores (`role="switch"`): apagar oculta los campos y prender los recupera con lo que tenían (también el texto editado).
- Marquesina:
  - "▲" del primero y "▼" del último deshabilitados;
  - bajar, subir, agregar (fila vacía con el foco, que no aparece en la vista previa), contador "11/40", quitar y editar, con la vista previa siguiendo cada cambio;
  - con 10, "Agregar texto" deshabilitado y "Hasta 10 textos."; con 9, de nuevo habilitado;
  - sin textos: "Sin textos, la banda no se muestra en la tienda." y sin banda;
  - vista previa amarilla, borde negro de 2px, sin animación y "★" solo entre textos.
- Errores de la API: WhatsApp `12345`, `mapaUrl` de otro dominio y un texto de 41 caracteres (le saqué el `maxlength` al input para poder escribirlo) → los 3 errores debajo de su campo (también en la fila de la marquesina), con `aria-invalid` y `aria-describedby`, el foco en WhatsApp y "Revisá los datos de la configuración." en la barra. Al escribir, el error del campo se va.
- Costo vacío con el envío apagado → el campo aparece con el error y el foco.
- Recargar con cambios → diálogo `beforeunload`.
- Sin errores de JavaScript.

*Guardar y tienda* (1280px; 28 chequeos, todos OK):
- Sin scroll horizontal ni controles chicos. Foco visible con Tab en el interruptor.
- Guardado con `336 412-3456`, costo `3.000`, el envío local apagado, `mapaUrl` y la marquesina reordenada:
  - "Guardar" deshabilitado ("Guardando…") mientras guarda;
  - el aviso con `AVISO_CDN` y el foco;
  - en Sanity: `5493364123456`, `envioLocal` `{ habilitado: false, costo: 3000, texto: "Solo San Nicolás" }`, la marquesina en el orden de la pantalla y el `mapaUrl`;
  - el formulario muestra lo guardado, y recargar ya no pregunta.
- **Tienda:**
  - el detalle de `/producto/dino-de-peluche` muestra solo "Retiro en el local" y "Envío a todo el país";
  - la marquesina del home, en el orden nuevo;
  - "Cómo llegar" → el `mapaUrl`, y el `iframe` sigue con la búsqueda;
  - el botón de WhatsApp, con el número nuevo.
- Volver a prender el envío: vuelven `3.000` y "Solo San Nicolás". Guardado con costo 0 → `{ habilitado: true, costo: 0 }`.
- **"Visitanos"** (con patches a Sanity, recargando la tienda hasta que llega el dato):
  - sin dirección y con `mapaUrl`: "Cómo llegar" con el link, sin mapa y una columna;
  - sin dirección ni `mapaUrl`: sin "Cómo llegar", sin mapa y una columna, a 1280 y a 375px, sin scroll horizontal;
  - con dirección y sin `mapaUrl`: la búsqueda por dirección, el mapa y dos columnas.
- **Formulario de productos** (por el CSS movido): igual que antes a 375px.

*Build:* `npm run build` sin errores. El panel sigue en chunks aparte (ver "Desvíos").

*Al terminar:* la configuración quedó **igual a la de antes de las pruebas** (comparada campo por campo con el backup, también sin `mapaUrl`, como estaba). La restauré con un `createOrReplace` del documento original después de cada tanda de pruebas. No se crearon productos ni imágenes.

**Capturas** (fuera del repo), en `C:\Users\Admin\Proyectos\Mundo Mickey\capturas\07-admin-configuracion\`:
- **formulario completo:** `form-375.png` y `form-1280.png` (capturas de página completa: la barra de "Guardar" queda a mitad de la imagen porque es `sticky`);
- **con errores:** `form-errores-375.png`, `form-errores-1280.png` y `form-error-marquesina-375.png` (el texto de 41 caracteres);
- **marquesina con vista previa:** `marquesina-375.png` y `marquesina-1280.png`;
- **guardado:** `guardado-1280.png`, con el aviso;
- **error de carga:** `error-carga-375.png`;
- **"Visitanos" en una columna sin mapa:** `visitanos-una-columna-1280.png` y `visitanos-una-columna-375.png`; con el link y sin dirección, `visitanos-sin-direccion-con-link-1280.png`;
- **regresión:** `regresion-form-producto-375.png`.
