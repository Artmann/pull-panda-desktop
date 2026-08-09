import { defineConfig } from 'vite'

// https://vitejs.dev/config
export default defineConfig({
  build: {
    commonjsOptions: {
      transformMixedEsModules: true
    },
    rollupOptions: {
      // hono-rate-limiter is an optional lazy import inside @hono/mcp's auth
      // middleware, which this app never uses.
      external: ['hono-rate-limiter', 'sql.js']
    }
  }
})
