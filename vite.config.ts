import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // `server` es solo el servidor de desarrollo (no afecta al build ni a Vercel)
  server: {
    proxy: {
      '/api': 'http://localhost:4000',
    },
    // El túnel de Cloudflare (`npm run tunel`) para probar Mercado Pago contra la PC: su URL cambia en cada corrida
    allowedHosts: ['.trycloudflare.com'],
  },
})
