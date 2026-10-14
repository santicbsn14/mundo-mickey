# Mundo Mickey

Tienda web de juguetes y peluches de Mundo Mickey (San Nicolás de los Arroyos), con pago por Mercado Pago y un panel `/admin` para que el dueño gestione productos y pedidos.

## Arrancar en local

Requiere Node 20 o más.

```bash
npm install
cp .env.example .env   # completar MONGODB_URI
npm run dev
```

- Front: http://localhost:5173
- API: http://localhost:4000 (el front la llama por `/api/...` a través del proxy de Vite)
- Estado: http://localhost:5173/api/health

Otros scripts: `npm run build` (chequeo de tipos + build) y `npm run preview`.

## Cómo está organizado

- `src/` — front: React + TypeScript + Vite, CSS plano (un archivo por componente).
- `server/` — API: Express con ES modules. `server/app.js` exporta la app **sin `listen`**.
- `api/index.js` — entrada de la Vercel Function: reexporta la app de `server/`.
- `server/dev.js` — solo local: carga `.env` y levanta la API en el puerto 4000.
- `public/` — logo y favicons.

Todo se despliega como **un solo proyecto de Vercel**: la SPA y la API comparten dominio, sin CORS.

## Docs

- [`docs/ARQUITECTURA.md`](docs/ARQUITECTURA.md) — stack, modelos, endpoints y decisiones.
- [`docs/DEPLOY.md`](docs/DEPLOY.md) — cómo configurar MongoDB Atlas y Vercel.
- [`docs/avances/`](docs/avances/) — qué se hizo en cada brief.
- [`docs/referencia/`](docs/referencia/) — maqueta y logo.
