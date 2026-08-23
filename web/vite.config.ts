import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Por defecto el dev server proxea /api directo a uvicorn (:8000) para que
// el SSE del feed en vivo no pase por nginx (que aún no deshabilita
// buffering). Contra el stack dockerizado completo: VITE_API_PROXY_TARGET=http://localhost:80
const apiProxyTarget = process.env.VITE_API_PROXY_TARGET ?? 'http://localhost:8000'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: apiProxyTarget,
        changeOrigin: false,
      },
    },
  },
})
