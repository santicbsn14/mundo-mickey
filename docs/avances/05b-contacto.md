# Avance 05b — Sección "Visitanos" y crédito en el footer

## Qué se hizo
- **Sección "Visitanos"** (`src/components/home/Visitanos.tsx` + `.css`), en el home después de "Cómo comprar", con `id="contacto"`:
  - fondo amarillo, texto negro y bordes negros de 2px arriba y abajo, como la marquesina;
  - título h2 con el mismo estilo que "Lo más buscado" y "Cómo comprar", y la bajada "Retirá tu compra en el local o pasá a conocer los juguetes.";
  - **Dirección:** `direccion`, y debajo "San Nicolás de los Arroyos" solo si la dirección no la nombra;
  - **Horarios:** `horarios` con `white-space: pre-line`, así respeta los saltos de línea;
  - botones pill: **"Escribinos por WhatsApp"** (negro con texto amarillo) a `wa.me/<dígitos>?text=Hola!%20Quiero%20hacer%20una%20consulta.` y **"Cómo llegar"** (borde negro) a `google.com/maps/search/?api=1&query=<consulta>`;
  - Instagram como link de texto `@usuario`;
  - mapa en un `iframe` de `maps.google.com/maps?q=<consulta>&output=embed`, sin API key, con `title="Mapa: <dirección>"`, `loading="lazy"`, `referrerpolicy="no-referrer-when-downgrade"` y `filter: grayscale(1)`. Va en un marco con borde de 2px y radio 22px: 4:3 en mobile y el alto de la columna desde 900px;
  - si falta un dato, no se muestra su bloque ni su botón. Sin dirección, no hay ni mapa ni "Cómo llegar".
- **Consulta del mapa:** `consultaMapa()` en `Visitanos.tsx`. Es la dirección, y si no nombra "San Nicolás", se le agrega `, San Nicolás de los Arroyos, Buenos Aires`. La usan el botón y el mapa.
- **Layout:** una columna en mobile (título, datos, botones, Instagram y mapa). Desde 900px, dos columnas con el mapa a la derecha.
- **Mientras carga la configuración:** se ven el título y la bajada, con el lugar de los datos, los botones y el mapa reservado (invisible). Si la configuración no llega, quedan solo el título y la bajada.
- **"Contacto" del header** ahora lleva a la sección: el `id="contacto"` salió del footer. No hubo que tocar el header ni el efecto del hash del `Home`.
- **Footer:** franja final con borde superior fino, texto de 14px en `--suave`:
  - `© <año actual> Mundo Mickey`, con `new Date().getFullYear()`;
  - "Desarrollado por **Santiago Viale Sistemas**", con el link a `https://vialesistemas.com.ar` (`target="_blank" rel="noopener"`, sin `noreferrer`), subrayado.

  En mobile van una debajo de la otra (`flex-wrap`). Está en todas las páginas de la tienda porque es el mismo `Footer`. El panel no lo monta.

## Archivos creados / modificados
- Nuevos:
  - `src/components/home/Visitanos.tsx` y `Visitanos.css`;
  - `docs/avances/05b-contacto.md`.
- Modificados:
  - `src/pages/Home.tsx`: import y `<Visitanos />` después de `<ComoComprar />`;
  - `src/components/layout/Footer.tsx` y `.css`: sin `id="contacto"`, más la franja `footer__credito`.
- No se tocaron el header, el carrito, el admin, la API, la configuración de Sanity, `docs/ARQUITECTURA.md` ni `package.json`.

## Decisiones tomadas durante la implementación
- **Detección de la ciudad sin tildes ni mayúsculas:** `incluyeCiudad()` normaliza la dirección (NFD, sin diacríticos y en minúsculas) y busca "san nicolas". Así, "San Nicolas" sin tilde tampoco duplica la ciudad. La misma función decide si se muestra la línea "San Nicolás de los Arroyos" y si se agrega la ciudad a la consulta.
- **La consulta se encodea una vez** (`encodeURIComponent`) y se usa igual en los dos links.
- **Reserva mientras carga:** es una copia invisible (`visibility: hidden`, `aria-hidden`) de la estructura real:
  - dos líneas para la dirección (la calle y la ciudad, que es el caso de una dirección real sin la ciudad);
  - una línea para los horarios;
  - los dos botones con sus textos reales, para que en 375px se partan en dos filas igual que los reales;
  - la línea de Instagram.

  El marco del mapa se muestra vacío, con un fondo de 8% de negro. Ver "Pendientes" para el resultado con el seed.
- **Mapa en desktop:** `min-height: 22rem`, y si no, el alto de la columna de los datos (el grid estira las dos celdas). Sin el mínimo, con pocos datos el mapa quedaba muy bajo.
- **Borde doble entre la sección y el footer:** los dos tienen un borde negro de 2px y quedaban pegados (4px). La sección lleva `margin-bottom: -2px` y el borde superior del footer la pisa. No se tocó el borde del footer porque en el detalle y en `/checkout` hace falta.
- **Hover de "Cómo llegar":** fondo negro al 8%, sin colores nuevos. El `translateY(-2px)` de los dos botones va dentro de `prefers-reduced-motion: no-preference`, como en el hero.
- **Foco:** la sección es clara, así que usa el contorno negro por defecto de `base.css` (3px). Lo mismo el link del footer.
- **El link del crédito va en `--suave` y peso 400**, a diferencia de los otros links del footer (negros y en 600), para que quede como dato secundario.

## Desvíos respecto al brief
- **`margin-bottom: -2px` en la sección**, para no tener el borde doble con el footer (ver "Decisiones"). No está en el brief.
- Ninguno más.

## Pendientes / problemas encontrados
- **Salto de layout con el seed en desktop:** la dirección del seed ("Dirección del local, San Nicolás de los Arroyos") ya incluye la ciudad. A 1280px entra en una línea, y la reserva tiene dos: la sección pasa de 593 a 567px (−25px) al llegar la configuración. A 375px la dirección del seed ocupa dos líneas y no hay salto (938 → 938). Con una dirección real sin la ciudad ("Av. Savio 123" + "San Nicolás de los Arroyos") son dos líneas en los dos anchos. Además, la sección está al final de la página, fuera de la pantalla al cargar, y si se entra por `#contacto` el `ResizeObserver` del `Home` la vuelve a ubicar.
- **Con la dirección real, conviene revisar el mapa:** con el texto de prueba del seed, Google ubica el centro de San Nicolás y muestra varios "Local". Si con la dirección real el punto no es exacto, en el brief 07 se puede sumar un link de mapa propio a la configuración, como dice el brief.
- **El título queda a 154px del borde superior, y no a 80px**, al ir a "Contacto". El `scroll-padding-top` deja el borde de la sección a 80px (justo debajo del header, que termina en 72px). Lo que queda entre los dos es el padding de la sección (4,5rem). El título se ve completo, debajo del header. Es el mismo criterio que "Cómo comprar".
- **Sin dirección, en desktop la columna derecha queda vacía** (ver `sin-direccion-1280.png`). Se ve prolijo, alineado a la izquierda. Si se prefiere, se puede pasar a una columna cuando no hay mapa.
- **Captura `visitanos-375.png`:** el mapa sale vacío. La captura recorta más allá del alto de la ventana, y Chrome headless no pinta el `iframe` de otro origen fuera de la pantalla. En `mapa-375.png`, que es una captura normal de la pantalla, el mapa se ve cargado a 375px.
- **El primer request de la configuración tardó más de 15 s una vez** (Sanity CDN). En las siguientes cargas llegó en menos de 5 s. Mientras tanto, la sección se mostró con la reserva, como corresponde.

## Cómo probarlo
```bash
cd "Mundo Mickey/mundo-mickey"
npx vite --port 5174   # o npm run dev
```
- **Home:** después de "Cómo comprar" aparece la sección amarilla con la dirección, los horarios, el mapa en grises, los dos botones e Instagram. "Escribinos por WhatsApp" abre `wa.me` con el mensaje y "Cómo llegar" abre la búsqueda de Google Maps.
- **"Contacto" del header**, desde el home, `/checkout` y un detalle: baja a la sección con el título visible. Bajá un poco, entrá a un producto y volvé con "atrás": vuelve a la misma posición.
- **Footer:** "© 2026 Mundo Mickey" y "Desarrollado por Santiago Viale Sistemas" en el home, el detalle y `/checkout`. En `/admin` no hay footer.
- **Sin dirección:** patch de `configuracion.direccion` a `""`. No hay ni mapa ni "Cómo llegar". Restaurala con otro patch (`npm run seed` no restaura la configuración).

**Verificado en esta sesión** (Chrome headless por CDP, contra el Vite de desarrollo en el 5174, con scripts propios en el scratchpad):
- **Orden del `main`:** hero, marquesina, `productos`, `como-comprar` y `contacto`. El footer no tiene `id`.
- **Sección:**
  - fondo `rgb(255, 221, 0)` y bordes de 2px negros arriba y abajo;
  - el marco del mapa con 2px de borde y radio 22px, `4 / 3` en mobile y `auto` en desktop;
  - el `iframe` con el `src`, el `title`, `loading="lazy"`, `referrerpolicy` y `filter: grayscale(1)` pedidos.
- **Links:**
  - `wa.me/5493360000000?text=Hola!%20Quiero%20hacer%20una%20consulta.`;
  - `google.com/maps/search/?api=1&query=Direcci%C3%B3n%20del%20local%2C%20San%20Nicol%C3%A1s%20de%20los%20Arroyos` (el seed ya incluye la ciudad, así que no se agrega);
  - `instagram.com/mundomickey`.

  Los tres con `_blank` y `noopener noreferrer`.
- **Columnas:**
  - 1280px: `526.5px 605.5px`, con el mapa a la derecha (x=625) y el mismo alto que los datos (419px);
  - 375px: una columna, con el mapa debajo;
  - sin scroll horizontal en los dos anchos.
- **Alto de la sección cargando → cargada:** 938 → 938 a 375px, y 593 → 567 a 1280px (ver "Pendientes").
- **Foco con Tab:** "Escribinos por WhatsApp", "Cómo llegar", "@mundomickey" y el link del footer con `:focus-visible` y contorno sólido negro de 3px.
- **Footer:**
  - "© 2026 Mundo Mickey";
  - el link a `https://vialesistemas.com.ar/` con `_blank` y `rel="noopener"`;
  - color `rgba(0, 0, 0, 0.62)`, 14px, subrayado y borde superior de 1px a 15% de negro;
  - en desktop, una línea a la izquierda y otra a la derecha (misma `y`). En 375px, una debajo de la otra.
- **La franja** aparece en `/producto/dino-de-peluche` y en `/checkout`. En `/admin` (que redirige a `/admin/login`) no hay `footer` ni franja.
- **"Contacto" del header**, desde el home, `/checkout` y el detalle: lleva a `/#contacto`, con el header terminando en 72px y el título a 154px.
- **"Atrás":** desde `/#contacto`, con `scrollY` 1500, entré a un producto (abre en 0) y volví: `scrollY` 1500.
- **Entre la sección y el footer** queda un solo borde (se superponen 2px).
- **Configuración cambiada por script** (patch a la API de Sanity):
  - con `direccion: ""`: sin mapa y sin "Cómo llegar"; quedan los horarios, WhatsApp e Instagram, sin scroll horizontal;
  - con `direccion: "Av. Savio 123"` y `horarios` en dos líneas: "Av. Savio 123" y debajo "San Nicolás de los Arroyos"; los horarios en dos líneas; consulta `Av.%20Savio%20123%2C%20San%20Nicol%C3%A1s%20de%20los%20Arroyos%2C%20Buenos%20Aires` en el botón y en el mapa.

  Restaurada después con otro patch, y comparada con la API sin CDN: `direccion` y `horarios` iguales a los originales.
- `npm run build`: sin errores ni warnings de TypeScript.
- Sin errores en la consola en ninguna de las pruebas.

**Capturas** (fuera del repo): `C:\Users\Admin\Proyectos\Mundo Mickey\capturas\05b-contacto\`:
- `visitanos-1280.png` y `visitanos-375.png`: la sección con los datos del seed (a 375px, el mapa sale vacío por la captura; ver "Pendientes");
- `mapa-375.png`: la sección en la pantalla a 375px, con el mapa cargado;
- `footer-1280.png` y `footer-375.png`;
- `sin-direccion-1280.png` y `sin-direccion-375.png`;
- `sin-ciudad-1280.png` y `sin-ciudad-375.png`: dirección sin la ciudad y horarios en dos líneas.
