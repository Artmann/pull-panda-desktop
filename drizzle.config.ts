import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './src/database/schema.ts',
  out: './drizzle',
  dialect: 'turso',
  dbCredentials: {
    url: 'file:./pull-panda.db'
  }
})
