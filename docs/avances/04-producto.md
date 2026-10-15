# Avance 04 — Detalle de producto

## Qué se hizo
- **Arreglos de navegación:**
  - los links de la nav del header (`/#productos`, `/#como-comprar` y `/#contacto`) pasaron de `<a href>` a `Link`. El logo ya era `Link`. Navegar ya no recarga la app, y el header se ve igual;
  - `ScrollArriba` en el `Layout` de la tienda: al cambiar el `pathname` sin hash, sube arriba de todo. Con hash no hace nada;
  - la marquesina, mientras carga la configuración, muestra la banda amarilla vacía con su altura final (59px). Sin configuración o sin textos se oculta como antes. El `ResizeObserver` del Home quedó como estaba.
- **`useProducto(slug)`** devuelve `{ estado: 'cargando' | 'error' | 'no-encontrado' | 'ok', producto, reintentar }`. Si cambia el slug, vuelve a `cargando` y descarta las respuestas viejas.
- **Página `/producto/:slug`:**
  - link "← Volver al catálogo" a `/#productos`;
  - galería, info y entrega. En mobile van una debajo de la otra. Desde 900px hay dos columnas (55/45) y la info queda sticky debajo del header;
  - `document.title` = `"<nombre> · Mundo Mickey"`. Al salir de la página vuelve el del `index.html`;
  - estados de cargando (esqueleto con la misma forma), error ("Reintentar") y no encontrado ("Este juguete ya no está disponible" + "Ver el catálogo"), dentro del layout de la tienda.
- **Componentes en `src/components/producto/`:**
  - `Galeria`: pista horizontal con `scroll-snap`, miniaturas que mueven la pista con `scrollTo`, y la miniatura activa sigue el `scrollLeft`. Con una sola foto no hay miniaturas. Lleva `srcset` de 600/1000/1400w y miniaturas de 160w;
  - `InfoProducto`: badge, `h1`, precio, descripción, "¡Quedan N!" / "¡Queda 1!" / "Sin stock" y el link "Consultar por WhatsApp". Hay un comentario donde va el botón "Agregar al carrito" (brief 05);
  - `EntregaProducto`: solo las opciones habilitadas. Sin configuración, solo muestra el retiro;
  - `OtrosProductos`: hasta 4 productos, sin el actual, por `orden`, con `CardProducto` normal. Si no hay otros o falla la carga, no se muestra.

## Archivos creados / modificados
- Nuevos:
  - `src/hooks/useProducto.ts`;
  - `src/components/layout/ScrollArriba.tsx`;
  - `src/components/producto/`: `Galeria.tsx`/`.css`, `InfoProducto.tsx`/`.css`, `EntregaProducto.tsx`/`.css` y `OtrosProductos.tsx`/`.css`;
  - `src/pages/Producto.css`;
  - `docs/avances/04-producto.md`.
- Modificados:
  - `src/pages/Producto.tsx`: reemplaza el placeholder;
  - `src/components/layout/Header.tsx`: solo los 3 links de la nav;
  - `src/components/layout/Layout.tsx`: monta `ScrollArriba`;
  - `src/components/home/Marquesina.tsx` y `.css`: estado cargando;
  - `src/pages/Home.tsx`: una dependencia más en el efecto del hash (ver "Desvíos").
- Borrado: `src/components/producto/.gitkeep`.
- No se tocaron `docs/ARQUITECTURA.md`, las queries, los tipos, la API, los scripts ni el admin.

## Decisiones tomadas durante la implementación
- **La entrega va debajo de la galería en desktop, no debajo de la info.** Con la info y la entrega en la columna derecha, esa columna medía 701px contra 623px de la galería (con una foto), así que el sticky nunca llegaba a engancharse. Con áreas de grilla (`"galeria info" / "entrega info"`), la info queda sola a la derecha (353px) y se mantiene pegada mientras se scrollean la galería y la entrega. En mobile el orden sigue siendo galería → info → entrega, sin duplicar el JSX.
- **`ScrollArriba` usa `behavior: 'instant'` y `useLayoutEffect`.** `base.css` tiene `scroll-behavior: smooth` en `html`, y con un `scrollTo(0, 0)` común la página nueva se habría visto subir animada. Con el layout effect sube antes de pintar.
- **Marquesina cargando:** se renderiza un `&nbsp;` con la misma clase que los textos reales (con su ★) en `color: transparent` y sin animación. Así la altura sale de las mismas métricas y no de un número fijo en el CSS. La medí en 59px cargando y cargada, a 1280 y a 375.
- **`useProducto` marca cada resultado con su slug y su intento.** Si no coinciden con los actuales, el hook devuelve `cargando`. Así el reset al cambiar de slug no necesita un `setState` dentro del efecto, y una respuesta vieja nunca se muestra.
- **La galería vuelve a la primera foto con `key={producto._id}`:** al cambiar de producto se monta de nuevo, con el estado y el scroll en cero.
- **Miniatura activa durante el scroll suave:** al tocar la miniatura 4 desde la 1, la activa pasaba por la 2 y la 3 mientras se movía la pista. Ahora se recuerda el destino y se ignora el scroll hasta llegar. Si el usuario toca, usa la rueda o el teclado en el medio, manda el usuario.
- **La activa tiene fondo amarillo y un borde más grueso hecho con `box-shadow: inset`.** Así no cambia el tamaño del botón.
- **La pista de la galería es enfocable** (`tabIndex=0`, `role="region"`, `aria-label="Fotos de <nombre>"`), solo con más de una foto. Chrome ya la hacía enfocable por ser un scroller, pero el contorno de foco quedaba recortado por el `overflow: hidden` del marco. Ahora el contorno va hacia adentro (`outline-offset: -6px`) y con las flechas se pasan las fotos.
- **Reduced motion en la galería:** `irA` consulta `matchMedia('(prefers-reduced-motion: reduce)')` y usa `behavior: 'auto'`. El CSS no alcanza, porque un `behavior: 'smooth'` en JS le gana al `scroll-behavior` de `base.css`.
- **Imágenes:** el `src` de respaldo es el de 1000w. La primera foto carga normal y las demás con `lazy`. Las miniaturas tienen `alt=""`, porque el botón ya tiene `aria-label`.
- **WhatsApp:** el número se limpia a solo dígitos, igual que en el footer.
- **"¡Quedan N!"** es un rótulo amarillo con borde negro. "Sin stock" copia el estilo de la card (borde punteado gris), con su propia clase para no depender de `CardProducto.css`.
- **El error de carga lleva un `h1`** ("No pudimos cargar este juguete.") con el estilo del texto del error del catálogo, para que la página tenga título también en ese estado.
- **Envío a todo el país** no muestra precio a la derecha (no se cobra en la web), solo el texto de la configuración.
- **Mientras carga la configuración, `EntregaProducto` muestra solo el retiro,** igual que sin configuración. En la práctica la configuración ya está o llega junto con el producto (la comparten el footer y la marquesina).
- **El keyframe del esqueleto se llama `producto-pulso`** y no `esqueleto-pulso`, para no chocar con el de `Grilla.css`, aunque sean iguales.

## Desvíos respecto al brief
- **`src/pages/Home.tsx` (una línea + comentario):** el efecto del hash ahora depende de `[hash, key]`. Con `Link`, tocar "Productos" estando ya en `/#productos` no cambia el hash, y el efecto no volvía a bajar. Antes lo resolvía el navegador, porque era un `<a>` nativo. Con `key`, cada click es una navegación nueva. No está en la lista de archivos del brief, pero sin este cambio se rompía la navegación con hash que pedía mantener.
- **La entrega en desktop va en la columna izquierda** (ver "Decisiones"). El brief no fijaba dónde iba el bloque de entrega, pero pedía la info sticky, y con la entrega a la derecha el sticky no funcionaba.

## Pendientes / problemas encontrados
- **ScrollArriba también sube al ir "atrás" con el navegador.** Si se vuelve del detalle al home sin hash, el home queda arriba en lugar de donde estaba. Restaurar la posición en "atrás" necesitaría `<ScrollRestoration>`, y eso pide pasar a un data router (`createBrowserRouter`). Lo dejo para cuando se decida.
- **El primer gesto táctil simulado** de la prueba a 375px no movió la pista. Los tres siguientes sí, y la miniatura acompañó en cada uno. Parece algo del gesto sintético en Chrome headless, pero conviene probarlo con el dedo en un celular real.
- **El error tarda en aparecer** si Sanity no responde, porque el cliente de `@sanity/client` reintenta solo. Con un fallo de conexión simulado apareció en ~1 s.
- **Demora del CDN de Sanity:** las mutaciones de prueba tardaron entre ~40 s y ~1 min en verse en el navegador, como en los briefs anteriores.
- **`npm run seed` no restaura la configuración** (usa `createIfNotExists`). `envioLocal.habilitado` lo volví a `true` con un patch aparte.

## Cómo probarlo
```bash
cd "Mundo Mickey/mundo-mickey"
npm run dev          # Vite en 5173, o 5174 si el 5173 está ocupado
```
- `/producto/osito-de-peluche-gigante`: foto, "El más pedido", `h1`, `$34.900`, descripción, "¡Quedan 3!", entrega con 3 opciones y "Consultar por WhatsApp". La pestaña dice "Osito de peluche gigante · Mundo Mickey".
- `/producto/robot-que-camina`: "¡Quedan 2!". `/producto/osito`: "Este juguete ya no está disponible".
- Desde el final del home, tocar un producto: el detalle abre arriba de todo.
- En el detalle, tocar "Productos", "Cómo comprar" o "Contacto" del header: en la pestaña Network no aparece un documento nuevo.
- **Varias fotos:** agregarle imágenes al osito con un patch (ver abajo) y probar deslizar a 375px y las miniaturas a 1280px. Después, `npm run seed`.
- **DevTools → Rendering → `prefers-reduced-motion: reduce`:** el esqueleto no pulsa y las miniaturas saltan sin animación.

**Verificado en esta sesión** (Chrome headless por CDP, con scripts propios en el scratchpad, sin dependencias nuevas):
- **Osito a 1280 y 375:** todos los datos de arriba; `wa.me/5493360000000?text=Hola!%20Quiero%20consultar%20por%20%22Osito%20de%20peluche%20gigante%22` con `target="_blank"` y `rel="noopener noreferrer"`; foto con `alt` = nombre, sin `lazy`, `sizes` correcto; 0 miniaturas; un solo `h1`; sin scroll horizontal.
- **Columnas:** 623px + 509px a 1280, una columna de 343px a 375. **Sticky:** con el viewport de 600px de alto y la página scrolleada 300px, la info queda a 96px (header hasta 72px) mientras la galería ya subió a -163px.
- **Header sin recarga** (marca en `window` que sobrevive al click): desde `/checkout` y desde `/producto/robot-que-camina`, los 3 links. `#productos` queda con el título a 144px (la sección a 80px), "Cómo comprar" y "Contacto" visibles debajo del header. "Productos" dos veces seguidas desde el home vuelve a bajar. El logo tampoco recarga.
- **Volver al catálogo:** lleva a `/#productos` con el título visible, y la pestaña vuelve a "Mundo Mickey · Juguetes y peluches".
- **Desde el final del home** (`scrollY` 2306) a un producto: `scrollY` 0.
- **Otros juguetes:** 4 productos que no son el actual; con el conejo inactivo, la pelota entra en su lugar. Tocar uno cambia el detalle sin recargar, con `scrollY` 0. Con el osito en la foto 3 → dino → osito, la galería vuelve a la foto 1.
- **Marquesina:** a 1280 y 375, desde el primer frame mide 59px cargando y 59px con textos, y la sección de productos no se mueve (766px / 996px).
- **Galería con 4 fotos** (dino, robot y cohete agregados al osito por script): `alt` "…, foto 2/3/4", con `lazy`, y "Ver foto N de 4" con `aria-current` en la activa. A 375, deslizando con eventos táctiles, la pista pasa a 339 → 678 → 339 y la miniatura activa acompaña (2, 3, 2), sin mover la página. A 1280, las miniaturas 3, 4 y 1 llevan la pista a 1237, 1855 y 0. Durante el scroll suave de la 1 a la 4, la activa pasa directo de 1 a 4. Las flechas del teclado sobre la pista enfocada pasan a la 2 y la 3.
- **Reduced motion:** a los 30 ms del click en la miniatura 4, la pista está en 10 (animando) normal y en 1855 (ya llegó) con reduce. El esqueleto queda con `animation: none`.
- **Dino con `stock: 0`:** "Sin stock" y sin "¡Quedan!". **Conejo con `activo: false`:** "Este juguete ya no está disponible". **`envioLocal.habilitado: false`:** entrega con "Retiro en el local" y "Envío a todo el país".
- **Esqueleto y error** (reteniendo o haciendo fallar la query del producto con `Fetch` de CDP): esqueleto con `aria-busy`, "Cargando juguete…" para lectores y el cuadrado de 623px / 343px. El error muestra el recuadro con `role="alert"`, y "Reintentar" carga el osito.
- **Foco con Tab:** logo, nav, carrito, volver, pista de la galería, las 4 miniaturas, WhatsApp y las cards, todos con contorno negro de 3px.
- Restaurado con `npm run seed` y el patch de `envioLocal`: verificado con la API sin CDN (6 productos activos, 1 imagen cada uno, stocks 3/5/4/2/6/8, solo el osito destacado, `envioLocal.habilitado: true`).
- Sin errores en la consola. `npm run build`: sin errores ni warnings de TypeScript.

**Capturas** (fuera del repo): `C:\Users\Admin\Proyectos\Mundo Mickey\capturas\04-producto\`:
- `detalle-osito-1280.png` y `detalle-osito-375.png`: página completa con los datos del seed;
- `galeria-varias-1280.png` (en la foto 3) y `galeria-varias-375.png` (en la foto 2): con 4 fotos;
- `foco-galeria-1280.png`: foco en la pista;
- `no-encontrado-1280.png` y `no-encontrado-375.png`;
- `esqueleto-1280.png` y `esqueleto-375.png`;
- `error-1280.png` y `sin-stock-1280.png`.
