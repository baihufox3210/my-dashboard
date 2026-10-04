import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    fs: {
      deny: ['**/security-flags.json'],
    },
    proxy: {
      '/api': { target: 'http://127.0.0.1:3001', xfwd: true },
      '/uploads': { target: 'http://127.0.0.1:3001', xfwd: true },
    },
  },
})
