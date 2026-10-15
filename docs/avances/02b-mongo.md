# Avance 02b — MongoDB Atlas

## Qué se hizo
- **Paso 0:** el brief 02 ya estaba commiteado (`a0d9241 Brief 02: conexión con Sanity y productos de prueba`), con el árbol de trabajo limpio. No hubo que commitear nada.
- **Pasos 1 y 2 (Atlas CLI y cluster propio): no se hicieron.** Ver "Desvíos".
- **Base de desarrollo provisoria:** Santiago cargó en `.env` la `MONGODB_URI` de un cluster que ya tenía en otro proyecto de Atlas, apuntando a la base `mundo-mickey`. Yo solo le corregí un prefijo duplicado (ver "Decisiones").
- **Paso 3 — Verificación contra Atlas:** con `npm run dev`, `GET /api/health` respondió 7 veces seguidas (1 directo al 4000 y 6 por el proxy de Vite):
  ```json
  { "ok": true, "db": "conectada", "sanity": "ok", "entorno": "local" }
  ```
  En todo ese rato, el log `MongoDB conectada (base: mundo-mickey)` apareció **una sola vez**.
- **Paso 4 — Sanity:** borré el CORS `http://localhost:3333` del proyecto `de0zicdv`. Quedan solo `http://localhost:5173` y `http://localhost:5174`, sin cambios.
- **Docs:** reescribí la sección MongoDB de `DEPLOY.md` (desarrollo provisorio + pasos en la web para producción) y le agregué a `.env.example` un ejemplo de formato.

### Comandos usados
```bash
git status; git log --oneline -5                    # brief 02 ya commiteado
winget install MongoDB.MongoDBAtlasCLI ...          # falló: 1602, UAC no aceptado
winget install MongoDB.MongoDBAtlasCLI --scope user # falló: no hay instalador por usuario
npm run dev                                          # + curl a /api/health, varias veces

# Sanity, desde una carpeta vacía fuera del repo, revisando el --help antes
npx sanity@latest cors delete --help
npx sanity@latest cors list -p de0zicdv              # 3333, 5173, 5174
npx sanity@latest cors delete http://localhost:3333 -p de0zicdv
npx sanity@latest cors list -p de0zicdv              # 5173, 5174
```

### Qué ya existía y qué es nuevo
| Recurso | Estado |
|---|---|
| Cluster de Atlas (desarrollo) | Ya existía, en otro proyecto de Atlas de Santiago. Lo cargó él. No lo toqué. |
| Base `mundo-mickey` | La crea Mongo sola con la primera escritura. Todavía no tiene colecciones. |
| Proyecto de Atlas "Mundo Mickey", cluster M0 `mundo-mickey` (AWS us-east-1), usuario `mundo-mickey-api` y acceso `0.0.0.0/0` | **No existen.** Quedan para el brief 12, documentados en `DEPLOY.md`. |
| CORS de Sanity `localhost:3333` | Existía y se borró. |

## Archivos creados / modificados
- `docs/DEPLOY.md`:
  - la sección "1. MongoDB Atlas" se reemplazó por "Desarrollo (provisorio)" y "Producción (brief 12)", con pasos en la web;
  - la fila de `MONGODB_URI` en la tabla de Vercel aclara que es la URI del proyecto propio;
  - en la sección Sanity, la línea de CORS ya no menciona el 3333.
- `.env.example`: comentario con el formato de `MONGODB_URI`, con valores falsos.
- `docs/avances/02b-mongo.md`: este archivo.
- `.env`: local, no versionado. Solo cambió la línea de `MONGODB_URI` (ver "Decisiones"); las otras 28 líneas quedaron igual.
- No se tocó nada de `src/` ni de `server/`.

## Decisiones tomadas durante la implementación
- **Prefijo duplicado en `.env`:** la línea había quedado `MONGODB_URI=MONGODB_URI=mongodb...`, seguramente al pegarla. Así, la URI que leía la app empezaba con `MONGODB_URI=` y no conectaba. Le saqué el prefijo de más con un script que reescribe solo esa línea, conservando los fines de línea.
- **La URI de desarrollo es de formato estándar** (`mongodb://` con tres hosts y `authSource=admin`), no `mongodb+srv://`. El driver la acepta igual, así que la dejé como está.
- **Procesos viejos:** había un `npm run dev` de Mundo Mickey del 14/10 (brief 02) que seguía vivo, con Vite en el 5174. Lo cerré. El de Plot Salud, en el 5173, no lo toqué. En esta corrida Vite levantó en el 5175, y la API en el 4000 de siempre.
- **Producción documentada como pasos en la web**, como pidió Santiago, y no con la Atlas CLI. Conservé los mismos criterios del brief original: proyecto propio, M0, AWS us-east-1, `mundo-mickey-api` con `readWrite@mundo-mickey`, `0.0.0.0/0` con comentario y contraseña de 32 caracteres alfanuméricos. Cambié el usuario de la guía anterior (`mundo-mickey-app`, "Read and write to any database") por `mundo-mickey-api` con permisos solo sobre la base.

## Desvíos respecto al brief
- **No se instaló la Atlas CLI ni se creó el proyecto/cluster propio.** `winget` no pudo instalarla: el MSI pide UAC y desde la terminal de Claude no se puede aceptar (código 1602), y no hay instalador por usuario. Santiago decidió no instalarla y usar provisoriamente un cluster que ya tenía en **otro proyecto de Atlas**, con la base `mundo-mickey`. Esto va contra lo que pedía el brief ("No usar un proyecto de Atlas existente de otro cliente"), pero **es solo para desarrollo**: en `DEPLOY.md` quedó que para producción (brief 12) hay que crear el proyecto propio.
- Por eso, de los criterios de aceptación **no se cumplen** los del proyecto "Mundo Mickey" en Atlas, el cluster M0 `mundo-mickey`, el usuario `mundo-mickey-api` y el `0.0.0.0/0`. Quedan como pendientes del brief 12.
- **No verifiqué qué permisos tiene el usuario de la URI de desarrollo.** Por el `authSource=admin` y que es de un cluster compartido, probablemente tenga más permisos que `readWrite@mundo-mickey`. Mientras se use solo en local, no es un problema.

## Pendientes / problemas encontrados
- **⚠ Rotar la contraseña del usuario de la URI de desarrollo.** Para revisar la URI sin mostrarla, la parseé con `new URL()`, que no acepta URIs con varios hosts. El error de Node incluyó el valor completo, y **la URI con la contraseña quedó impresa en la salida de la sesión de Claude Code**. No se escribió en ningún archivo del repo ni de docs, pero hay que cambiarla en Atlas (Database Access → Edit → Edit Password) y actualizar `.env`. Si ese usuario lo usan otras apps del otro proyecto, hay que actualizarlas también.
- **Brief 12:** crear el proyecto de Atlas propio, siguiendo `DEPLOY.md` → "Producción", y cargar esa URI en Vercel. **No usar la de desarrollo.**
- **`node --watch` se reinició ~12 veces solo al arrancar** (log `Restarting 'server/dev.js'`). Coincidió con la convivencia con los procesos viejos de ayer. Después de cerrarlos se quedó estable y no se reinició más durante las pruebas. Mientras tanto, el proxy de Vite devolvió 502, pero no volvió a pasar. Si se repite en otra sesión, vale la pena mirarlo.
- La base no tiene colecciones todavía: los modelos llegan desde el brief 08.

## Cómo probarlo
```bash
cd "Mundo Mickey/mundo-mickey"
npm run dev
```
- `http://localhost:<puerto de Vite>/api/health` (5173, 5174 o 5175, según qué esté ocupado) → `{ "ok": true, "db": "conectada", "sanity": "ok", "entorno": "local" }`.
- Recargá varias veces: en la consola, `MongoDB conectada (base: mundo-mickey)` aparece una sola vez.
- `npx sanity@latest cors list -p de0zicdv` (desde una carpeta sin archivos de Sanity) → solo `http://localhost:5173` y `http://localhost:5174`.
- `npm run build` → compila, y la URI no aparece en `dist/`.
