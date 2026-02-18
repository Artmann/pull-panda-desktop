import { drizzle } from 'drizzle-orm/sql-js'
import { migrate } from 'drizzle-orm/sql-js/migrator'
import initSqlJs, { type Database as SqlJsDatabase } from 'sql.js'
import { app } from 'electron'
import path from 'node:path'
import fs from 'node:fs'

import * as schema from './schema'

function isCliMode(): boolean {
  return process.env.PULLPANDA_CLI === '1'
}

function getPackageRoot(): string {
  // __dirname is .vite/build/ inside the package
  return path.resolve(__dirname, '..', '..')
}

function getDatabasePath(): string {
  if (isCliMode()) {
    return path.join(app.getPath('userData'), 'pull-panda.db')
  }

  const isDevelopment = !app?.isPackaged

  if (isDevelopment) {
    return path.join(process.cwd(), 'pull-panda.db')
  }

  return path.join(app.getPath('userData'), 'pull-panda.db')
}

function getMigrationsPath(): string {
  if (isCliMode()) {
    return path.join(getPackageRoot(), 'drizzle')
  }

  const isDevelopment = !app?.isPackaged

  if (isDevelopment) {
    return path.join(process.cwd(), 'drizzle')
  }

  // In production, migrations are bundled in the app resources
  return path.join(process.resourcesPath, 'drizzle')
}

function getWasmPath(): string {
  if (isCliMode()) {
    return path.join(
      getPackageRoot(),
      'node_modules',
      'sql.js',
      'dist',
      'sql-wasm.wasm'
    )
  }

  const isDevelopment = !app?.isPackaged

  if (isDevelopment) {
    return path.join(
      process.cwd(),
      'node_modules',
      'sql.js',
      'dist',
      'sql-wasm.wasm'
    )
  }

  return path.join(process.resourcesPath, 'sql-wasm.wasm')
}

let database: ReturnType<typeof drizzle> | null = null
let sqliteInstance: SqlJsDatabase | null = null

export async function initializeDatabase(): Promise<
  ReturnType<typeof drizzle>
> {
  if (database) {
    return database
  }

  const wasmBuffer = fs.readFileSync(getWasmPath())
  const wasmBinary = wasmBuffer.buffer.slice(
    wasmBuffer.byteOffset,
    wasmBuffer.byteOffset + wasmBuffer.byteLength
  ) as ArrayBuffer
  const SQL = await initSqlJs({ wasmBinary })
  const databasePath = getDatabasePath()

  let fileBuffer: Buffer | null = null

  if (fs.existsSync(databasePath)) {
    fileBuffer = fs.readFileSync(databasePath)
  }

  sqliteInstance = fileBuffer
    ? new SQL.Database(fileBuffer)
    : new SQL.Database()

  database = drizzle(sqliteInstance, { schema })

  // Apply database migrations
  const migrationsPath = getMigrationsPath()
  migrate(database, { migrationsFolder: migrationsPath })

  return database
}

export function getDatabase() {
  if (!database) {
    throw new Error(
      'Database not initialized. Call initializeDatabase() first.'
    )
  }

  return database
}

export function setDatabase(db: ReturnType<typeof drizzle> | null): void {
  database = db
}

export async function createInMemoryDatabase(): Promise<
  ReturnType<typeof drizzle>
> {
  const wasmBuffer = fs.readFileSync(getWasmPath())
  const wasmBinary = wasmBuffer.buffer.slice(
    wasmBuffer.byteOffset,
    wasmBuffer.byteOffset + wasmBuffer.byteLength
  ) as ArrayBuffer
  const SQL = await initSqlJs({ wasmBinary })
  const sqlite = new SQL.Database()
  const db = drizzle(sqlite, { schema })

  // Apply migrations for in-memory database (used in tests)
  const migrationsPath = getMigrationsPath()
  migrate(db, { migrationsFolder: migrationsPath })

  return db
}

export function saveDatabase(): void {
  if (!sqliteInstance) {
    return
  }

  const databasePath = getDatabasePath()
  const data = sqliteInstance.export()
  const buffer = Buffer.from(data)

  // Ensure directory exists
  const dir = path.dirname(databasePath)

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }

  fs.writeFileSync(databasePath, buffer)
}

export function closeDatabase(): void {
  if (sqliteInstance) {
    saveDatabase()
    sqliteInstance.close()
    sqliteInstance = null
  }

  database = null
}
