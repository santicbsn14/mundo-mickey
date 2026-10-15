# Avance 05 — Carrito

## Qué se hizo
- **Productos compartidos** (`useProductos.ts`):
  - la carga es una promesa a nivel de módulo, exportada como `cargarProductos()`. El home, "Otros juguetes" y el carrito hacen un solo request por carga de página;
  - el resultado ya resuelto se guarda: al volver al home, la grilla aparece directo, sin esqueletos;
  - `reintentar` descarta la promesa y vuelve a pedir. Si el request falla, la promesa también se descarta sola, así el próximo que la pida vuelve a intentar.
- **`CarritoContext`** (`CarritoProvider` + `useCarrito()`):
  - expone lo que pide el brief, más `actualizado` (para el aviso de la sincronización);
  - límite por stock en `agregar` y en `cambiarCantidad`. Con cantidad 0, el ítem se quita;
  - persistencia en `localStorage` (`mundo-mickey:carrito`, `version: 1`), dentro de `try/catch`. Si lo guardado no tiene la forma esperada, arranca vacío. `abierto` no se guarda;
  - sincronización con Sanity al iniciar, que quita, acota y avisa. Si falla, el carrito queda como estaba;
  - envuelve solo el `Layout` de la tienda: `/admin` no tiene ni el botón ni el drawer.
- **Drawer** (`CarritoDrawer`), como la maqueta:
  - en el pie, "Subtotal", la nota "El envío lo elegís en el siguiente paso." y "Continuar compra", que cierra el drawer y lleva a `/checkout`;
  - accesibilidad completa: `role="dialog"`, foco atrapado, Escape y el velo cierran, el foco vuelve al botón del header y la página de atrás no scrollea;
  - se cierra solo al cambiar de ruta.
- **`ItemCarrito`:** miniatura de 56px (112w), nombre con link al detalle (también cierra el drawer), precio del ítem, "−" / "+" con `aria-label` y "Máximo disponible: N" al llegar al tope.
- **Header:**
  - el contador muestra `cantidadTotal`;
  - el botón abre el drawer;
  - `aria-label` "Abrir carrito, N productos".
- **Estrella que vuela** (`volarAlCarrito.ts`): Web Animations API, con la misma curva y duración de la maqueta. También hace el `pop` del botón del header.
- **Botones de agregar:**
  - en las cards (home y "Otros juguetes"), "Agregar" → "¡Sumado!" (900 ms) → "Sin más stock";
  - en el detalle, "Agregar al carrito" grande, con los mismos estados, y debajo "Tenés N en el carrito · Ver carrito";
  - agregar no abre el drawer.
- **"Atrás" vuelve donde estaba:** `ScrollArriba` no sube en `POP`. En su lugar, restaura la posición guardada por `location.key` en `sessionStorage`. Ver "Decisiones".
- **`docs/DEPLOY.md`:** sección "Probar en el celular" al final.

## Archivos creados / modificados
- Nuevos:
  - `src/context/CarritoContext.tsx`;
  - `src/components/carrito/`:
    - `CarritoDrawer.tsx`/`.css` e `ItemCarrito.tsx`/`.css`;
    - `volarAlCarrito.ts`;
    - `useSumado.ts` (ver "Desvíos");
  - `docs/avances/05-carrito.md`.
- Modificados:
  - `src/hooks/useProductos.ts`;
  - `src/components/layout/`: `Header.tsx`, `Layout.tsx` y `ScrollArriba.tsx`;
  - `src/components/catalogo/`: `CardProducto.tsx`/`.css` y `Grilla.tsx`;
  - `src/components/producto/`: `InfoProducto.tsx`/`.css` y `OtrosProductos.tsx`;
  - `src/pages/Home.tsx` (ver "Desvíos");
  - `docs/DEPLOY.md`.
- Borrados: los `.gitkeep` de `src/components/carrito/` y `src/context/`.
- **`Header.css` no se tocó:** el `pop` lo hace `volarAlCarrito` con Web Animations, así que no hizo falta un `@keyframes`.
- No se tocaron `docs/ARQUITECTURA.md`, la API, los scripts, el admin, las queries ni los tipos.

## Decisiones tomadas durante la implementación
- **El botón del header se ubica por `id`** (`ID_BOTON_CARRITO = 'btn-carrito'`, exportado desde `volarAlCarrito.ts`). Lo usan la estrella, el `pop` y el drawer, para devolverle el foco. Un `ref` en el contexto obligaba a pasarlo por el provider sin ninguna ventaja: el botón es uno solo y nadie necesita re-renderizar.
- **El `pop` usa Web Animations y no una clase CSS.** Mismos keyframes que la maqueta (35% → 1.14, 65% → 0.95, 450 ms, con el easing por tramo, como en un `@keyframes`). Así, la condición "con reduced motion o sin `animate`, no anima" queda en un solo lugar para la estrella y el `pop`. Además, no hace falta tocar el `className` de un elemento que maneja React.
- **"Sin más stock" y el "+" en el tope usan `aria-disabled` y no `disabled`.** Con `disabled`, el botón que tiene el foco lo pierde al llegar al tope: el foco se va al `body` y, en el drawer, se escapa de la trampa. Con `aria-disabled`, los lectores lo anuncian igual como deshabilitado, el click no hace nada y el look es el de la maqueta. "Continuar compra" sí usa `disabled`: el carrito se vacía desde los botones "−", así que en ese momento el foco no está en él.
- **Si el ítem con el foco desaparece** ("−" en 1), el foco vuelve a "Cerrar carrito".
- **La trampa de foco** escucha Tab en el `document` mientras el drawer está abierto y cicla entre el primer y el último enfocable del panel. Si por algún motivo el foco quedó afuera, Tab lo devuelve adentro.
- **`visibility` con retraso al cerrar.** En la maqueta, `visibility: hidden` se aplica en el acto, así que el panel desaparece sin verse salir. Acá la `visibility` cambia recién cuando termina la transición (`visibility 0s linear .4s`), y al abrir cambia en el acto. Cerrado sigue fuera del Tab.
- **Bloqueo del scroll:** `overflow: hidden` en el `html`, más `scrollbar-gutter: stable` para que la página de atrás no se corra cuando desaparece la barra. Al cerrar se restauran los dos valores anteriores.
- **El aviso de sincronización** se borra cuando se cierra un drawer que estaba abierto. Si el drawer "se cierra" por un cambio de ruta sin haberse abierto, el aviso sigue esperando. Tiene `role="status"`.
- **Sincronización:** cuenta como cambio solo lo que pide el brief: un ítem quitado (porque no está, está inactivo o tiene stock 0) o una cantidad acotada. Si cambian el precio, el nombre o la imagen, se actualizan sin aviso.
- **Validación de lo guardado:** se revisa todo el arreglo, campo por campo. `productoId`, `slug` y `nombre` tienen que ser textos no vacíos; `precio` y `stock`, enteros ≥ 0; `cantidad`, un entero ≥ 1, e `imagen`, `null` o un objeto con `asset._ref`. Si cualquier ítem falla, el carrito arranca vacío. Además, se descartan los repetidos y los de stock 0, y se acotan las cantidades al stock guardado.
- **`agregar` usa los datos del producto que recibe:** precio, stock e imagen se refrescan con lo último que se vio.
- **La cantidad del ítem tiene `aria-live="polite"`**, así se anuncia el cambio al tocar "−" o "+". En el detalle, "Tenés N en el carrito" vive dentro de una región `aria-live` que está siempre en el DOM, para que se anuncie al aparecer.
- **El `aria-label` del header dice "1 producto"** en singular, y "N productos" en los demás casos.
- **Restauración del scroll:** primero probé solo con no subir en `POP`, dejando la restauración nativa:
  - **sin hash** (`/` → producto → atrás) funcionó exacto: 1772 → 1772 a 1280 y 2167 → 2167 a 375, gracias a que los productos ya están en memoria;
  - **con hash** (`/#productos`, que es a donde llevan "Volver al catálogo" y "Productos" del header) no funcionó. Chrome restauraba y enseguida hacía un scroll suave al ancla: 1286 → 686.

  Por eso quedó **`scrollY` por `location.key` en `sessionStorage`** (`mundo-mickey:scroll`):
  - en `POP`, `ScrollArriba` restaura antes de pintar y lo repite dos frames después, lo que cancela el scroll al ancla de Chrome;
  - el efecto del hash del `Home` no corre si es `POP` y hay una posición guardada (si no, el `ResizeObserver` lo volvía a anclar);
  - la posición se guarda en cada evento `scroll`, con la `key` del momento del evento. El scroll que provoca el cambio de página ya cuenta para la página nueva.

  Resultado: 1286 → 1286 y 1516 → 1516, también con hash.
- **`ScrollArriba` ahora depende de `key`**, y no solo de `pathname`, para poder restaurar al ir "adelante" y "atrás" entre entradas con el mismo `pathname`. Sigue subiendo solo cuando cambia el `pathname` y la navegación no es `POP`.

## Desvíos respecto al brief
- **`src/components/carrito/useSumado.ts` (archivo nuevo, no listado):** el estado de "¡Sumado!" durante 900 ms, con su timer. Lo usan `CardProducto` e `InfoProducto`, y así el timer no está duplicado.
- **`CardProducto` recibe además `enCarrito`**, y `onAgregar` pasa a recibir `(producto, origen)`. `origen` es el botón desde donde vuela la estrella. Con `enCarrito`, la card no depende del contexto, y la arman `Grilla` y `OtrosProductos`.
- **`src/pages/Home.tsx` (una condición):** con "atrás" a `/#productos`, el efecto del hash no corre si `ScrollArriba` ya restauró la posición. Sin este cambio, el criterio de "atrás" fallaba cada vez que se entraba al home por "Volver al catálogo" o por el header.
- **`npm run dev -- --host` no funciona:** `concurrently` se queda con el `--host` sin dar error, y Vite no lo recibe (lo comprobé). En `DEPLOY.md` quedó `npx vite --host`, más `node --watch server/dev.js` en otra terminal si hace falta la API. No toqué `package.json`; ver "Pendientes".
- **La nota del pie va entre el subtotal y el botón**, en el orden en que la lista el brief. En la maqueta, la nota de Mercado Pago iba debajo del botón.

## Pendientes / problemas encontrados
- **Script para el celular:** si se usa seguido, conviene sumar a `package.json` un `"dev:host"` igual a `dev` pero con `vite --host`. No lo hice porque el brief no tocaba `package.json`.
- **Demora del CDN:** la sincronización ve los cambios de Sanity con la demora del CDN. En esta prueba fueron 28 s. Después de `npm run seed`, el CDN siguió un rato con el stock parcheado del robot (1), y un carrito con el robot ×2 se acotó a ×1. La validación real es la del brief 08.
- **Con Sanity caído, el error de la grilla tarda** varios segundos en aparecer, porque `@sanity/client` reintenta solo (igual que en el brief 04). El carrito no se ve afectado: muestra lo guardado.
- **Reduced motion en el drawer:** el `transition: none` del drawer pierde contra el `!important` de `base.css`, que deja las transiciones en 0,01 ms. En la práctica es lo mismo: a los 30 ms del click, el panel ya está en su lugar.
- **No probé en un celular real** el bloqueo del scroll ni el drawer en iOS Safari: lo dejé documentado en "Probar en el celular" para hacerlo con el dedo. `overflow: hidden` en el `html` funciona en iOS 16 o más nuevo.
- **No hay anuncio para lectores de pantalla al agregar desde una card**, fuera del cambio del texto del botón. Si hace falta, se puede sumar una región `aria-live` global con "Sumaste X al carrito".

## Cómo probarlo
```bash
cd "Mundo Mickey/mundo-mickey"
npm run dev          # Vite en 5173, o 5174 si el 5173 está ocupado
```
- **Agregar:** en el home, "Agregar" en el robot. Vuela la estrella, el botón del header hace `pop`, el contador pasa a 1 y el botón dice "¡Sumado!" un momento. Una vez más y dice "Sin más stock".
- **Drawer:** "Carrito" del header. Probá "−" y "+", "Máximo disponible: 2", vaciar, "Continuar compra" y el nombre de un ítem.
- **Teclado:** Tab hasta "Carrito" y Enter. El foco cae en ✕, Tab y Shift+Tab no salen del panel, y Escape cierra y devuelve el foco al botón.
- **Persistencia:** recargá. Para el caso corrupto, en DevTools → Application → Local Storage, escribí basura en `mundo-mickey:carrito` y recargá: el carrito queda vacío.
- **Sincronización:**
  1. con el robot ×2 en el carrito, bajale el stock a 1 por script. Para probar la baja, poné un producto del carrito en `activo: false`;
  2. esperá ~30–90 s y recargá. Queda el robot ×1, el otro desaparece y aparece el aviso;
  3. restaurá con `npm run seed`.
- **"Atrás":** bajá hasta el final del home, entrá a un producto (abre arriba) y volvé con "atrás". Probalo también entrando al home por "Volver al catálogo".
- **Reduced motion:** DevTools → Rendering → `prefers-reduced-motion: reduce`. No vuela la estrella, no hay `pop` y el drawer aparece sin deslizarse.

**Verificado en esta sesión** (Chrome headless por CDP, contra el `vite` de desarrollo en 5174, con scripts propios en el scratchpad, sin dependencias nuevas):
- **Card del robot:**
  - después del click aparecen la estrella en el `body` y una animación activa en el botón del header (`getAnimations().length` 1); el botón dice "¡Sumado!" y el contador, 1;
  - a los 1000 ms vuelve a "Agregar" y la estrella ya no está;
  - con la segunda unidad: "Sin más stock" con `aria-disabled="true"`. Un tercer click no suma (el contador sigue en 2);
  - `aria-label` del header: "Abrir carrito, 2 productos".
- **Teclado:**
  - Enter en el botón del header → drawer visible, de 430px, con el foco en "Cerrar carrito" y el `html` con `overflow: hidden`;
  - 7 Tabs: nombre → quitar → sumar → "Continuar compra" → cerrar → nombre → quitar, sin salir nunca del panel;
  - Shift+Tab desde cerrar → "Continuar compra";
  - la rueda del mouse sobre el velo no mueve la página;
  - Escape → `visibility: hidden`, foco en el botón del header y `overflow` restaurado;
  - click en el velo → cierra.
- **Drawer:**
  - robot ×2: `$52.800`, "Máximo disponible: 2" y el "+" con `aria-disabled`;
  - "−" → ×1, `$26.400`, subtotal `$26.400` y sin "Máximo";
  - "+" → ×2 y `$52.800`; "+" en el tope no suma;
  - "−" dos veces con Enter → estado vacío, "Continuar compra" deshabilitado y el foco en "Cerrar carrito";
  - la card del robot vuelve a "Agregar".
- **Navegación desde el drawer:**
  - osito + dino ×2 → 2 ítems, `$77.900` y el header en 3;
  - "Continuar compra" → `/checkout`, drawer cerrado y `overflow` restaurado;
  - el nombre de un ítem → `/producto/osito-de-peluche-gigante`, drawer cerrado. Estando ya en ese detalle, el link también cierra.
- **Recarga:** el contador sigue en 3, con `{"version":1,"items":[…]}` en `localStorage`.
- **`localStorage` corrupto:** probé `{no es json`, `version: 2`, un ítem sin campos, `[1,2,3]` y `null`. Con los cinco, el carrito arranca en 0 y queda guardado `{"version":1,"items":[]}`. Sin errores en la consola.
- **Detalle del robot:**
  - "Agregar al carrito" → "¡Sumado!", con la estrella, y después "Tenés 1 en el carrito · Ver carrito";
  - con la segunda unidad, "Sin más stock" con `aria-disabled`;
  - "Ver carrito" abre el drawer;
  - "Agregar" desde "Otros juguetes" suma al mismo carrito;
  - en el home, la card del robot dice "Sin más stock".
- **`/admin`:** no está `#btn-carrito`, ni `.carrito`, ni `.velo`.
- **375px:**
  - con 6 productos en el carrito, el drawer mide 375px y arranca en `left: 0`;
  - la lista scrollea (523 > 478) con el pie fijo;
  - sin scroll horizontal, con el drawer abierto y cerrado.
- **Reduced motion:** sin estrella y sin animaciones en el botón del header, pero con "¡Sumado!" y el contador funcionando. El drawer queda en su lugar a los 30 ms.
- **Sincronización contra Sanity real:**
  - con robot ×2, conejo ×1 y osito ×1 en el carrito, puse `seed-robot.stock = 1` y `seed-conejo.activo = false` por la API de mutaciones;
  - a los 28 s, el CDN ya lo mostraba. Al recargar: robot ×1 con "Máximo disponible: 1", el conejo afuera, el header en 2 y el aviso con `role="status"`;
  - cerrar y abrir el drawer borra el aviso;
  - el carrito actualizado queda guardado.
- **Sanity bloqueado** (`Network.setBlockedURLs`): con un carrito guardado de 3 unidades (una de un producto inexistente), el contador sigue en 3. Al desbloquear, el inexistente se quita y aparece el aviso.
- **Restaurado** con `npm run seed` y verificado con la API sin CDN: 6 activos, stocks 3/5/4/2/6/8, órdenes 1 a 6 y solo el osito destacado. La configuración no se tocó.
- **"Atrás"** (a 1280 / 375):
  - desde el final del home (1772 / 2167) → pelota (`scrollY` 0) → atrás: 1772 / 2167, sin esqueletos;
  - "adelante" → el detalle en 0;
  - desde `/#productos` scrolleado (1286 / 1516) → cohete (0) → atrás: 1286 / 1516.
  - La navegación con hash desde `/checkout` sigue dejando `#productos` a 80px.
- `npm run build`: sin errores ni warnings de TypeScript.

**Capturas** (fuera del repo): `C:\Users\Admin\Proyectos\Mundo Mickey\capturas\05-carrito\`:
- `drawer-items-1280.png` y `drawer-items-375.png`: con ítems (a 375, con 6 productos y la lista scrolleable);
- `drawer-vacio-1280.png` y `drawer-vacio-375.png`;
- `drawer-aviso-1280.png` y `drawer-aviso-375.png`: con el aviso de sincronización;
- `card-sin-mas-stock-1280.png` y `card-sin-mas-stock-375.png`;
- `detalle-en-carrito-1280.png`: "Sin más stock" y "Tenés 2 en el carrito · Ver carrito".
