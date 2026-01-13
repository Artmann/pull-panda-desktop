import { drizzle } from 'drizzle-orm/sql-js'
import { migrate } from 'drizzle-orm/sql-js/migrator'
import initSqlJs, { type Database as SqlJsDatabase } from 'sql.js'
import { app } from 'electron'
import path from 'node:path'
import fs from 'node:fs'

import * as schema from './schema'

function getDatabasePath(): string {
  const isDevelopment = !app?.isPackaged

  if (isDevelopment) {
    return path.join(process.cwd(), 'pull-panda.db')
  }

  return path.join(app.getPath('userData'), 'pull-panda.db')
}

function getMigrationsPath(): string {
  const isDevelopment = !app?.isPackaged

  if (isDevelopment) {
    return path.join(process.cwd(), 'drizzle')
  }

  // In production, migrations are bundled in the app resources
  return path.join(process.resourcesPath, 'drizzle')
}

let database: ReturnType<typeof drizzle> | null = null
let sqliteInstance: SqlJsDatabase | null = null

export async function initializeDatabase(): Promise<
  ReturnType<typeof drizzle>
> {
  if (database) {
    return database
  }

  const SQL = await initSqlJs()
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
  const SQL = await initSqlJs()
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
