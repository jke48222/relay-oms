/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Dev-time proxy: the SPA talks to relative /api and /socket paths and Vite
// forwards them to Phoenix on :4000 — the same shape production has, where
// nginx/ingress fronts both tiers under one origin. No CORS anywhere.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': { target: 'http://localhost:4000', changeOrigin: true },
      '/socket': { target: 'ws://localhost:4000', ws: true },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
