import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      "/api/ocr": {
        target: "http://192.168.5.47:8001",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/ocr/, "/ocr"),
      },
    },
  },
})