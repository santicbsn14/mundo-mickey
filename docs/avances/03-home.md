# Avance 03 — Home y catálogo

## Qué se hizo
- **`src/lib/sanity.ts`:** el cliente se crea en el primer uso (`sanity()`), igual que en la API. Si faltan las `VITE_SANITY_*`, el error lo recibe la query que llama. El catálogo muestra su error y el resto de la tienda anda.
- **Hooks** en `src/hooks/`:
  - `useProductos()` devuelve `{ estado, productos, error, reintentar }` e ignora la respuesta si el componente se desmontó;
  - `useConfiguracion()` hace un solo request por carga de página (promesa a nivel de módulo): la marquesina y el footer lo comparten.
- **Home real**, como la maqueta: `Hero`, `Marquesina`, `Grilla` y `ComoComprar`.
- **Catálogo desde Sanity:**
  - el destacado va primero y grande;
  - en mobile, la última card ocupa las 2 columnas si queda sola;
  - estados de cargando (6 esqueletos), error con "Reintentar" y vacío.
- **`CardProducto`:**
  - la foto y el nombre llevan a `/producto/:slug`;
  - `srcset`/`sizes` según el tamaño de la card y `lazy` en todas menos la destacada;
  - "Sin stock" con `stock === 0`;
  - el botón "Agregar" aparece solo si se pasa `onAgregar`, y en este brief no se pasa.
- **Marquesina y footer** leen la configuración y degradan solos si no está: la marquesina no se renderiza y el footer queda con el logo y los títulos.
- **Navegación con hash** desde otras páginas (`/#productos`, `/#como-comprar` y `/#contacto`).

## Archivos creados / modificados
- Nuevos:
  - `src/hooks/useProductos.ts` y `src/hooks/useConfiguracion.ts`;
  - `src/components/home/`: `Hero.tsx`/`.css`, `Marquesina.tsx`/`.css`, `ComoComprar.tsx`/`.css` y `osito.svg` (el SVG `osito` de la maqueta, con `xmlns`);
  - `src/components/catalogo/`: `Grilla.tsx`/`.css` y `CardProducto.tsx`/`.css`;
  - `docs/avances/03-home.md`.
- Modificados:
  - `src/lib/sanity.ts`: cliente y builder de imágenes perezosos;
  - `src/lib/queries.ts`: solo `sanity.fetch` → `sanity().fetch` (ver "Desvíos");
  - `src/pages/Home.tsx`: reemplaza la lista temporal;
  - `src/components/layout/Footer.tsx` y `.css`: datos de la configuración;
  - `docs/ARQUITECTURA.md`: línea `hooks/` en "Estructura de carpetas".
- Borrados: los `.gitkeep` de `src/components/home/` y `src/components/catalogo/`.
- `base.css` no se tocó: ya tenía `scroll-padding-top: calc(env(safe-area-inset-top, 0px) + 80px)`.

## Decisiones tomadas durante la implementación
- **`sanity` pasó de constante a función** (`sanity()`), con el mismo criterio que `sanityLectura()` en la API. El builder de `urlImagen` también se crea en el primer uso.
- **Los hooks llaman a la query dentro de `Promise.resolve().then(...)`.** Así, si `sanity()` tira de forma sincrónica al faltar las variables, el error llega como rechazo y pasa al estado `error`, sin romper el render.
- **`useConfiguracion` guarda también el valor ya resuelto.** Si la marquesina se vuelve a montar (por ejemplo, al volver al home desde `/checkout`), aparece directo, sin parpadeo de "cargando".
- **Marquesina:**
  - la duración se calcula en proporción a la cantidad de textos (5,2 s por texto: la maqueta recorre 5 textos en 26 s). Así la velocidad no cambia aunque haya más o menos textos;
  - con los 5 textos del seed, el bloque queda en 10 (dos vueltas de la lista) y la pista en 20;
  - sigue con `aria-hidden`, como en la maqueta, porque es decorativa y duplica los textos.
- **Navegación con hash:** el `scrollIntoView` solo no alcanzaba. Después del scroll cargan la marquesina y los productos (que reemplazan a los esqueletos) y empujan la sección unos 60px hacia abajo. En la primera prueba, `#productos` quedaba a 139px del borde superior en lugar de 80px. Por eso `Home` vuelve a ubicar la sección con un `ResizeObserver` sobre el `body` mientras la página se acomoda. Corta a los 3 segundos o apenas el usuario scrollea, toca o usa el teclado. Ahora queda exacto en los 80px del `scroll-padding-top`.
- **Foto de la card:**
  - el `Link` de la foto tiene `tabIndex={-1}`: el nombre ya es un link al mismo lugar, y así el teclado no pasa dos veces por cada card. La imagen mantiene `alt` = nombre, como pide el brief;
  - el badge queda fuera del link, para que no forme parte del texto del link.
- **`card--ancha-mobile`** también lleva la foto a 16:10 en mobile. Si no, la última card sería un cuadrado de todo el ancho (~343px de foto).
- **Hover y reduced motion:** el lift, el zoom de la imagen y el `translateY` de los botones del hero van dentro de `@media (hover: hover) and (prefers-reduced-motion: no-preference)`. Con reduced motion, el hover solo muestra la sombra sólida, sin movimiento.
- **Foco:** el hero y "Cómo comprar" llevan la clase `.fondo-oscuro` de `base.css` (contorno amarillo). El resto usa el negro por defecto.
- **Clases de los botones del hero:** `hero__btn` y no `.btn` global, porque `base.css` no se podía tocar. El botón "Reintentar" tiene su propio estilo en `Grilla.css`.
- **Footer:** `whatsapp` se limpia a solo dígitos y a `instagram` se le saca el `@` inicial. Dirección y horarios van en párrafos separados. Saqué el comentario "en el brief 07 salen de la configuración", porque ya salen de ahí.
- **Esqueletos:** usan `aria-busy` y un texto solo para lectores de pantalla ("Cargando productos…"). Tienen `pointer-events: none`, para que no hagan hover.

## Desvíos respecto al brief
- **`src/lib/queries.ts` cambió en 3 líneas** (`sanity.fetch` → `sanity().fetch`). El brief no permitía tocar las queries salvo que algo no compilara, y al pasar `sanity` a función no compilaba. Las queries en sí (GROQ y campos) quedaron igual.
- **`object-fit: cover` con las ilustraciones del seed:** como pide el brief, la imagen ocupa toda la caja. En la maqueta los SVG quedaban al 70% con margen. Con las ilustraciones de prueba se ven más grandes y algo recortadas, sobre todo en la destacada a 16:10. Con fotos reales es lo correcto.

## Pendientes / problemas encontrados
- **Los links del header son `<a href>` y no `Link`:** desde otra página recargan la app entera. Funciona (la recarga cae en el home y el hook baja a la sección), pero en el brief 05 **el carrito se perdería al navegar así** si no se persiste. Hay que pasarlos a `Link` (el brief prohibía tocar el `Header`) o guardar el carrito en `localStorage`.
- **Desde el home, con mobile por debajo de 820px, el header no tiene links de secciones** (la nav está oculta, igual que en la maqueta). La navegación con hash solo se probó a 1280px.
- **CORS de Sanity:** el front solo puede leer desde `localhost:5173` y `localhost:5174`. Un `vite preview` en otro puerto (lo probé en el 4180) termina en "No pudimos cargar los productos." después de ~20 s. Para probar el build en local, usá el 5174 (`npx vite preview --port 5174`) o sumá el puerto a los CORS.
- **El estado "vacío"** ("Pronto vas a encontrar juguetes acá.") no lo probé en el navegador: habría que dejar el dataset sin productos activos. La lógica es una rama simple (`ok` con 0 productos).
- **En modo dev con "Slow 3G", la página tarda más de 40 s en cargar,** porque Vite sirve cientos de módulos sueltos. La prueba de los esqueletos la hice contra el build (`vite preview`).
- **Demora del CDN:** al cambiar datos, la grilla tardó **63 s y 99 s** en reflejarlos (con caché del navegador desactivada). Coincide con lo visto en el brief 02 (`max-age=60`).
- Al reintentar sin variables, el error vuelve casi al instante, porque falla antes de salir a la red. Con un error de red real se ven los esqueletos mientras reintenta.

## Cómo probarlo
```bash
cd "Mundo Mickey/mundo-mickey"
npm run dev          # Vite en 5173, o 5174 si el 5173 está ocupado
```
- **1280px:** hero en 2 columnas, marquesina, grilla de 3 columnas con el osito 2×2, "Cómo comprar" en 3 columnas y footer en 3 columnas.
- **375px:** todo en una columna salvo la grilla (2 columnas). La pelota (última card) ocupa todo el ancho y no hay scroll horizontal.
- **DevTools → Rendering → `prefers-reduced-motion: reduce`:** no se mueve nada (ni el título, ni la órbita, ni la marquesina), y en el hover solo aparece la sombra.
- **Tab desde el principio:** contorno negro en el header y en las cards, y amarillo en los botones del hero.
- **Desde `/checkout`, "Productos" del header:** lleva al home y deja el título justo debajo del header.
- **Esqueletos:** con "Slow 3G" contra `npm run build && npx vite preview --port 5174`.
- **Sin Sanity, sin tocar `.env`:**
  ```bash
  VITE_SANITY_PROJECT_ID= npx vite build --outDir /tmp/dist-sin-sanity
  npx vite preview --port 5174 --outDir /tmp/dist-sin-sanity
  ```
  Se ve todo menos el catálogo (error con "Reintentar") y la marquesina. El footer queda solo con el logo y los títulos.
- **Datos:** con un `patch` en Sanity (`orden`, `destacado` o `stock`), la grilla lo refleja en ~1 minuto. Después, `npm run seed` deja todo como estaba.

**Verificado en esta sesión** (Chrome headless por CDP, con un script propio en el scratchpad, sin dependencias nuevas):
- 6 productos con imagen, badge, nombre, descripción y precio (`$34.900`, `$21.500`, `$18.900`, `$26.400`, `$15.900`, `$9.800`). Las imágenes usan `w=600` en las normales y `w=1200` en la destacada.
- Columnas a 1280/375: hero 2/1, grilla 3/2, pasos 3/1 y footer 3/1. Un solo `h1`. Sin scroll horizontal en los dos anchos.
- Marquesina con los 5 textos de la configuración (20 en la pista, 52 s). Footer con dirección, horarios, `wa.me/5493360000000` e `instagram.com/mundomickey`, con `target="_blank"` y `rel="noopener noreferrer"`.
- **Click** en la foto del dino → `/producto/dino-de-peluche`; **click** en el nombre del osito → `/producto/osito-de-peluche-gigante`.
- **Hover:** card `translateY(-6px)`, sombra `0 8px 0` e imagen `scale(1.06)`. Con reduced motion: solo la sombra.
- **Reduced motion:** la marquesina, la órbita, el peluche y el chip con `animation: none`, y el título, el texto y la escena ya en su lugar a los 300 ms.
- **Foco:** el header, el logo y las cards en negro; "Ver productos" y "Cómo comprar" del hero en amarillo.
- **Hash desde `/checkout`:** `#productos` a 80px del borde superior, con el header terminando en 72px. "Cómo comprar" y "Contacto" quedan al final de la página (no hay más para scrollear), con el título visible.
- **Slow 3G** (preview): 6 esqueletos, con la primera grande y la última ancha en mobile, entre los segundos 6 y 12. Después, 6 cards.
- **Cambios de datos por script:**
  - `pelota.orden = 0`, el robot destacado en lugar del osito y `dino.stock = 0` → robot grande, pelota, osito, dino "Sin stock", cohete y conejo;
  - con osito y robot destacados a la vez → solo el osito grande (el de menor `orden`) y el robot como card normal.

  Restaurado con `npm run seed` y verificado con la API sin CDN: órdenes 1 a 6, solo el osito destacado y el stock original.
- **Sin `VITE_SANITY_PROJECT_ID`:** el hero, "Cómo comprar", el header y el footer se ven. El catálogo muestra el error con `role="alert"` y "Reintentar", la marquesina no aparece y no hay pantalla en blanco.
- `npm run build`: sin errores ni warnings de TypeScript.

**Capturas** (fuera del repo): `C:\Users\Admin\Proyectos\Mundo Mickey\capturas\03-home\`:
- `home-1280.png` y `home-375.png`: página completa;
- `maqueta-1280.png`: la maqueta, para comparar. Chrome headless la renderizó en su modo oscuro, que la tienda no tiene;
- `esqueletos-1280.png` y `esqueletos-375.png`;
- `sin-stock-1280.png` y `datos-cambiados-1280.png`;
- `sin-sanity-1280.png` y `sin-sanity-375.png`;
- `foco-hero.png`.
