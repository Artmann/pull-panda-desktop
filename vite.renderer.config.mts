import path from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vitejs.dev/config
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  // The @pierre/diffs highlight worker lazy-loads Shiki themes and grammars
  // with dynamic imports, which the default iife worker format cannot bundle.
  worker: {
    format: 'es'
  }
})
