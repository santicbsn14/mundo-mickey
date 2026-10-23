# Avance 06b — Admin: pantallas de productos

## Qué se hizo
- **`DELETE /api/admin/productos/:id` borra solo el documento.** Las fotos quedan, para no romper la imagen de los pedidos que compraron ese producto. Las que no usa nadie las limpia `npm run imagenes:limpiar`. En `ARQUITECTURA.md`: la fila del endpoint y la decisión "Borrar un producto no borra sus fotos, para no romper los pedidos".
- **Compresión en el navegador** (`src/lib/imagenes.ts`, `comprimirImagen`):
  - decodifica con `createImageBitmap(archivo, { imageOrientation: 'from-image' })`, y si no está o falla, con un `<img>` y un object URL;
  - lado mayor de 1600px como máximo (sin agrandar) y WebP 0,85. Si el navegador no exporta WebP, JPEG 0,85. Si pasa los 3,5 MB, reintenta con 0,7;
  - si no se puede leer: "No pudimos leer esta foto. Probá con otra o sacale una captura de pantalla.".
- **Subidor de fotos** (`SubidorImagenes`), controlado (`imagenes` + `onChange`), con `onEstado({ subiendo, fallidas })` para el formulario:
  - "Agregar fotos (N de 8)": botón grande que abre el `input type="file" accept="image/*" multiple` oculto;
  - límite de 8: se toman las que entran y se avisa "Se pueden cargar hasta 8 fotos." (también al tocar el botón con 8 cargadas);
  - cada foto aparece al instante con una vista previa local y pasa por "En espera…" → "Preparando…" → "Subiendo…" → lista, **de a una**;
  - si falla: el mensaje, "Reintentar" y "Quitar". Al terminar, la miniatura pasa a la URL de Sanity y se libera el object URL;
  - grilla cuadrada con `object-fit: cover`, con el texto "Así se ven en la tienda…", el rótulo "Portada" en la primera, "◀"/"▶" (deshabilitados en los extremos), "Hacer portada" y "Quitar", todos de 44px como mínimo y con los `aria-label` del brief;
  - sin fotos: el recuadro punteado "Todavía no hay fotos. Agregá al menos una.".
- **Formulario** (`FormProducto`), para `/admin/productos/nuevo` y `/admin/productos/:id`:
  - los 8 campos en el orden del brief, con `label` visible y letra de 16px. El precio acepta `34900` o `34.900` y muestra debajo "En la tienda: $34.900". Stock con "−" y "+". Etiqueta con las 3 sugerencias tocables. Destacado y Visible como interruptores (`checkbox` con `role="switch"`), con sus aclaraciones;
  - en edición: "Ver en la tienda ↗" (pestaña nueva) a `/producto/<slug>`;
  - validación del front: solo fotos y nombre. Los errores de la API (`ErrorApi.campos`) van debajo de cada campo (con `aria-invalid` y `aria-describedby`), y el mensaje general en un recuadro con `role="alert"` arriba del botón. El foco va al primer campo con error;
  - "Guardar" fijo abajo (sticky). Deshabilitado mientras suben fotos ("Esperá a que suban las fotos…") o mientras guarda ("Guardando…");
  - al guardar, vuelve al listado con "Listo, se guardó «<nombre>». Puede tardar hasta un minuto en verse en la tienda.";
  - cambios sin guardar: `beforeunload` al cerrar o recargar, y `confirm()` en "Volver";
  - "Eliminar producto" al final, en estilo texto, con un `<dialog>` de confirmación ("Cancelar" / "Eliminar") que vuelve al listado con "Se eliminó «<nombre>».";
  - estados de cargando, error (con "Reintentar") y "Este producto no existe".
- **Listado** (`ListaProductos`) en `/admin/productos`:
  - título, "Nuevo producto", y estados de cargando, error con "Reintentar" y vacío con "Crear el primero";
  - cada producto en una tarjeta: portada cuadrada, nombre, precio, stock ("Sin stock" si es 0), y los rótulos "★ Destacado" (amarillo) y "Oculto" (borde punteado). Toda la tarjeta abre el formulario (link estirado), además de "Editar";
  - "Ocultar"/"Mostrar" con un `PUT` del producto completo, y "Subir"/"Bajar" con `PATCH /orden`. Los cambios se ven al instante y, si fallan, vuelven atrás con el error debajo de la fila;
  - el aviso del CDN, una sola vez por visita al listado;
  - la nota "El orden de esta lista es el orden de la tienda (el destacado siempre va primero).".

## Archivos creados / modificados
- **Nuevos:**
  - `src/lib/imagenes.ts` (ver "Desvíos": venía de una sesión anterior);
  - `src/lib/productosAdmin.ts`: tipos del panel (`ProductoAdmin`, `ImagenAdmin`, `CuerpoProducto`), `cuerpoDesde()` (el producto completo para un `PUT`), `miniatura()` y el texto del aviso del CDN;
  - `src/components/admin/SubidorImagenes.tsx` + `.css`, `FormProducto.tsx` + `.css` y `ListaProductos.tsx` + `.css`;
  - `docs/avances/06b-admin-productos.md`.
- **Modificados:**
  - `src/pages/admin/AdminProductos.tsx` y `AdminProductoForm.tsx` (este último carga el producto y maneja los estados de carga);
  - `src/components/admin/AdminLayout.css`: piezas comunes del panel (`.adm-btn`, `.adm-alerta`, `.adm-aviso`, `.adm-rotulo`, `.adm-error-campo`…);
  - `server/controllers/adminProductos.js`: el `DELETE`;
  - `docs/ARQUITECTURA.md`: solo lo del `DELETE`.

## Decisiones tomadas durante la implementación
- **Diseño desde 900px:**
  - **formulario en dos columnas** (fotos a la izquierda, datos a la derecha). Con las fotos al lado se ve el recorte mientras se completan los datos;
  - **listado: cada producto en una sola línea, como una tabla** (foto, nombre, precio, stock y acciones alineados), pero con `<ul>` y grid, no `<table>`. Así la misma estructura sirve para el celular (tarjeta en dos filas), y toda la fila sigue siendo tocable.
- **Las fotos pendientes van al final de la grilla** y no se pueden mover hasta que suben. El formulario solo recibe las que ya están en Sanity, en su orden. Si el dueño mueve fotos mientras otra sube, la nueva se suma al final sin pisar ese orden.
- **"En espera…"**, un estado más que el brief: con 3 fotos, las que esperan turno no dicen "Preparando…" sin estar comprimiéndose.
- **Una foto que no se puede leer muestra solo "Quitar"**, sin "Reintentar": reintentar daría el mismo error. "Reintentar" aparece cuando falló la subida, y no vuelve a comprimir (guarda la foto ya achicada).
- **Fotos fallidas y "Guardar":** el botón se deshabilita solo mientras hay subidas en curso, como pide el brief. Si quedan fotos fallidas y se toca "Guardar", no se guarda: aparece "Hay fotos que no se subieron: reintentá o quitalas." debajo de Fotos. Así no se guarda un producto sin una foto que el dueño cree cargada.
- **Foto repetida:** Sanity reconoce un archivo idéntico y devuelve el mismo asset. Si eligen dos veces la misma foto, no se agrega de nuevo y se avisa "Esa foto ya estaba cargada." Sin esto, la API rechazaba el guardado ("Hay una foto repetida") y React tenía claves duplicadas.
- **Precio:** el input solo deja escribir números y puntos. En edición arranca con puntos (`26.400`), como lo escribiría el dueño. Si queda algo que no es un entero, se manda `null` y el error lo da la API debajo del campo.
- **Las miniaturas piden a Sanity la foto achicada sin recortar** (`?w=400&auto=format`, y 160 en el listado). El cuadrado es solo CSS, igual que en la tienda.
- **Acciones rápidas, una a la vez:** mientras se guarda una, se deshabilitan todas las de la lista (no solo las de esa fila). Así un `PUT` y un reordenamiento no se pisan.
- **El aviso del listado se saca del historial** (`navigate('.', { replace: true, state: null })`): recargar o volver atrás no lo muestra de nuevo. Si viene del formulario, cuenta como el aviso del CDN de esa visita.
- **"Ver en la tienda"** agrega "(está oculto: en la tienda no se ve)" si el producto está oculto, porque esa página da "no encontrado".
- **El formulario se remonta (`key`) al cambiar de producto o pasar a "Nuevo"**, porque las dos rutas usan el mismo componente.
- **La alerta general va dentro de la barra fija de "Guardar"**: queda siempre visible, arriba del botón. Si el error no es de un campo (por ejemplo, sin conexión), el foco va a la alerta.

## Desvíos respecto al brief
- **Lo que ya estaba hecho de una sesión anterior:** al empezar había cambios sin commitear en `ARQUITECTURA.md`, `adminProductos.js` y `src/lib/imagenes.ts` (del 2026-10-15). Coincidían con este brief: los revisé, los probé y los incluí tal cual.
- **Archivo nuevo que no estaba listado:** `src/lib/productosAdmin.ts`, con los tipos y el armado del cuerpo del `PUT`, compartidos entre el listado y el formulario.
- **Estilos comunes en `AdminLayout.css`** (botones, alertas, avisos, rótulos), que se carga con todo el panel, en vez de repetirlos en cada CSS.
- **El chunk de la tienda cambió de forma, no de contenido.** Ahora el panel también importa `react-dom` (por `flushSync`, para mover el foco después de mostrar los errores). Por eso Vite separa React y React Router en un chunk compartido (`chunk-*.js`), y `api.ts` en el suyo. No hay código del panel en la tienda: busqué `adm-btn`, `subidor`, `lp__fila`, `comprimirImagen` y el texto de la foto ilegible, con 0 apariciones fuera de los chunks del panel.

  | JS que carga la tienda | Antes (HEAD) | Después |
  |---|---|---|
  | `index-*.js` | 424,71 kB (131,34 gzip) | 376,49 kB (115,11 gzip) |
  | `chunk-*.js` (React + React Router) | — | 48,34 kB (17,15 gzip) |
  | `api-*.js` | — | 1,17 kB (0,70 gzip) |
  | `jsx-runtime-*.js` | 0,96 kB (0,55 gzip) | 0,96 kB (0,55 gzip) |
  | **Total** | **425,67 kB (131,89 gzip)** | **426,96 kB (133,51 gzip)** |

  Son +1,3 kB (+1,6 kB gzip) por tener un archivo más. El CSS de la tienda quedó igual (23,46 kB).

## Pendientes / problemas encontrados
- **El CDN de Sanity puede tardar más de un minuto.** Después de "Ocultar", la query de la tienda contra el API CDN siguió mostrando el producto durante **117 segundos**. El reordenamiento tardó 55 y el producto nuevo apareció a los 4. El aviso dice "hasta un minuto" (texto del brief). Propuesta: "Puede tardar un par de minutos en verse en la tienda." Es una línea en `AVISO_CDN` (`src/lib/productosAdmin.ts`). **A definir.**
- **Mongo de desarrollo no conecta:** `/api/health` responde "Could not connect to any servers in your MongoDB Atlas cluster", porque la IP actual no está habilitada en Atlas. No afecta a este brief (productos e imágenes van a Sanity), pero para el 08 hay que agregar la IP en Atlas → Network Access.
- **`npm run dev` reinicia la API en bucle:** `node --watch server/dev.js` mostraba "Restarting 'server/dev.js'" cada pocos segundos, sin cambios de archivos (esta sesión no tocó nada del server mientras corría). Corriendo `node server/dev.js` sin `--watch` anda bien. No lo investigué más. Si a Santiago le pasa, puede ser OneDrive o el antivirus tocando archivos.
- **Fotos que quedan en Sanity:** las que se quitan de un producto, las de productos borrados y las que se suben sin guardar quedan como assets. `npm run imagenes:limpiar` borra las huérfanas de más de 24 horas, pero todavía no sabe de los pedidos: después de borrar un producto, la foto de sus pedidos viejos se borraría con el script. Queda para el brief 08, como dice este brief.
- **iPhone con fotos HEIC:** Safari en iOS convierte a JPEG al elegir de la galería con `accept="image/*"`, así que no debería pasar. Si algún navegador no puede leerla, aparece el mensaje del brief. No lo pude probar en un iPhone real.
- **Arrastrar para reordenar** no está, a propósito (sin librerías). Con 8 fotos como máximo, las flechas y "Hacer portada" alcanzan.

## Cómo probarlo
```bash
cd "Mundo Mickey/mundo-mickey"
npm run dev            # o npm run dev:host para el celular
```
Entrá a `/admin/login` (la contraseña de desarrollo está comentada en el `.env`) y andá a **Productos**.

- **Crear:** "Nuevo producto" → "Agregar fotos" y elegí 3 juntas. Aparecen al instante y suben de a una. Mové, "Hacer portada", "Quitar". Nombre, precio `12.500` y la sugerencia "Nuevo" → "Guardar" → vuelve al listado con el aviso, y el producto queda al final.
- **Errores:** nombre de una letra → el error queda debajo del campo, con el foco ahí.
- **Editar:** tocá la fila → "Ver en la tienda ↗" abre `/producto/<slug>`. Cambiá el nombre y guardá: el link sigue igual.
- **Sin guardar:** cambiá algo y recargá (pide confirmación), o tocá "Volver" (pregunta).
- **Eliminar:** al final del formulario → diálogo → "Eliminar" → "Se eliminó «…»".
- **Listado:** "Ocultar"/"Mostrar" y "Subir"/"Bajar". El primer cambio muestra el aviso del CDN.
- **Al terminar:** `npm run seed` y, pasadas 24 horas, `npm run imagenes:limpiar`.

**Verificado en esta sesión** (Chrome headless por CDP, Vite en el 5174 y la API en el 4000):

*Compresión* (`comprimirImagen` en el navegador, con fotos generadas):

| Foto | Original | Subida | Final |
|---|---|---|---|
| `grande-4000x3000.jpg` (ruido, JPEG 0,95) | 10.918.631 bytes (10,4 MB) | 727.048 bytes (710 KB), WebP | 1600×1200 |
| `vertical-exif6.jpg`: 800×600 con EXIF orientación 6 | 5.256 bytes | 1.706 bytes, WebP | **600×800** |
| `chica-a.jpg`, de 1200×900 | 16.760 bytes | 6.466 bytes, WebP | 1200×900 (no se agranda) |

- **EXIF:** la foto con orientación 6 la armé a mano: un JPEG apaisado de 800×600 con una franja negra **arriba**, y le inserté un segmento APP1 EXIF con `Orientation = 6`. Si se respeta la rotación, tiene que quedar vertical con la franja **a la derecha**. El resultado: 600×800, píxel derecho negro (0) e izquierdo blanco (255). En Sanity quedó como `…-600x800-webp`.
- **Respaldos:** con un `toBlob` que no exporta WebP (devuelve PNG), salió JPEG. Con un primer resultado de más de 3,5 MB, se llamó de nuevo con 0,7: `webp 0.85`, `jpeg 0.85`, `webp 0.7`, `jpeg 0.7`.
- **Ilegibles:** un `.txt` y un texto renombrado a `.jpg` dan el mensaje del brief.

*Fotos* (375px):
- 3 juntas: a los 21 ms ya estaban las 3 ("Preparando… | En espera… | En espera…"). Subieron de a una en 8,5 s, y "Guardar" estuvo deshabilitado ("Esperá a que suban las fotos…") hasta el final.
- Con 3 cargadas, elegir 6 → entran 5 (quedan 8) y el aviso. Con 8, tocar "Agregar fotos" o elegir otra → el aviso, y siguen siendo 8.
- Extremos deshabilitados y la primera sin "Hacer portada". "Mover foto 2 antes", "Mover foto 3 después", "Hacer portada" en la 5.ª y "Quitar" dejan el orden esperado. Al crear, el orden guardado en Sanity coincide con el de pantalla.
- Con `/api/admin/imagenes` bloqueado: "No se pudo conectar con el servidor…" con "Reintentar". Al desbloquear y reintentar, subió.
- `.txt` y `.jpg` falso: el mensaje, solo "Quitar", y el formulario sigue andando. Guardar con una fallida → el aviso debajo de Fotos, con el foco ahí.
- La misma foto dos veces → una sola, y "Esa foto ya estaba cargada.".

*Formulario* (375px):
- Vacío → "Subí al menos una foto." y "El nombre es obligatorio.", con el foco en "Agregar fotos".
- Nombre "A" → "El nombre tiene que tener entre 2 y 80 caracteres." debajo del campo, `aria-invalid`, el foco en el nombre y "Revisá los datos del producto." arriba del botón. Al escribir, el error se va.
- Creado con 2 fotos, `12.500`, stock 3 y "Nuevo": precio 12500, badge "Nuevo", `orden` 7, al final del listado y con el aviso. **En la tienda** apareció a los 4 s: `/producto/peluche-de-prueba-06b` con "$12.500" y la portada correcta (la que puse primera), y al final de la grilla.
- Editado a "…editado" y $13.900: el slug sigue igual. "Ver en la tienda" → `/producto/peluche-de-prueba-06b`, con `target="_blank"`.
- Destacado en "Dino de peluche" → un solo "★ Destacado" en el listado y en Sanity.
- Con cambios: recargar → diálogo `beforeunload`. "Volver" → `confirm("Tenés cambios sin guardar. ¿Salir igual?")`: cancelando se queda, aceptando vuelve. Sin cambios, ninguno de los dos pregunta.
- Eliminar: el diálogo con el texto del brief y el foco en "Cancelar". "Cancelar" lo cierra y "Esc" también. "Eliminar" → "Se eliminó «…»". El producto ya no está, y **sus 2 assets siguen existiendo** (la URL responde 200).
- "Guardar" visible arriba y a mitad del formulario. Sin scroll horizontal, y ningún control de menos de 44px a 375 y 1280.
- `/admin/productos/no-existe` → "Este producto no existe".

*Listado:*
- "Ocultar": todos los botones deshabilitados mientras guarda. Después, "Oculto", "Mostrar", `activo: false` en Sanity y el aviso del CDN. **La tienda lo sacó a los 117 s** (ver "Pendientes").
- Aviso cerrado → "Mostrar" y "Subir" no lo vuelven a mostrar.
- "Subir" en el último → anteúltimo al instante, en Sanity y en la tienda (a los 55 s). "Bajar" lo devuelve.
- Con el `PUT` bloqueado: "No se pudo ocultar: No se pudo conectar…" debajo de la fila, y el producto vuelve a "visible".
- Sin errores de JavaScript en la consola en ninguna prueba.

*Build:*
- `npm run build` sin errores. El panel sigue en chunks aparte. **El chunk del formulario (`AdminProductoForm-*.js`) pesa 17,46 kB (5,68 kB gzip)**, más 5,87 kB de CSS (1,73 gzip). El del listado, 4,61 kB (1,68 gzip) y 2,36 kB de CSS.

*Al terminar:*
- Borré los productos de prueba y las 11 fotos huérfanas que subieron estas pruebas (solo las creadas en esta sesión), y corrí `npm run seed`.
- Quedaron los 6 productos del seed, con el osito como destacado y el orden de 1 a 6, 6 imágenes en total y la configuración intacta.

**Capturas** (fuera del repo), en `C:\Users\Admin\Proyectos\Mundo Mickey\capturas\06b-admin-productos\`:
- **listado:** `lista-375.png`, `lista-1280.png`, `lista-aviso-375.png` (después de guardar) y `lista-oculto-375.png`;
- **formulario nuevo con fotos subiendo:** `nuevo-fotos-subiendo-375.png` y `nuevo-fotos-subiendo-1280.png`;
- **formulario con errores:** `form-errores-375.png` y `form-errores-1280.png`;
- **fotos con error:** `foto-error-375.png` (API cortada, con "Reintentar") y `foto-no-imagen-375.png`;
- **diálogo de eliminar:** `dialogo-eliminar-375.png` y `dialogo-eliminar-1280.png`;
- **tienda:** `tienda-producto-creado-1280.png`, con el producto creado a $12.500.
