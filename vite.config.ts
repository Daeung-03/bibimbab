import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { reportApi } from './server/report-api'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    base: env.VITE_BASE_PATH || '/',
    plugins: [react(), tailwindcss(), reportApi({
      apiKey: process.env.LINER_API_KEY || env.LINER_API_KEY,
      model: process.env.LINER_MODEL || env.LINER_MODEL || 'liner-mark-1.1',
      allowedOrigins: (env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean),
    })],
    server: { port: 5173, strictPort: true },
    preview: { port: 4173, strictPort: true },
  }
})
