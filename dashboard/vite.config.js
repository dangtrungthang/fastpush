import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
const allowedHosts = ['codepush.orderx.vn', 'codepush-api.orderx.vn']

export default defineConfig({
  plugins: [react()],
  server: {
    allowedHosts,
    proxy: {
      '/api': {
        target: 'https://codepush-api.orderx.vn',
        changeOrigin: true,
        secure: true,
      },
    },
  },
  preview: {
    allowedHosts,
  },
})
