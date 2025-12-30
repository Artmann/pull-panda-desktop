import { drizzle } from 'drizzle-orm/better-sqlite3'
import Database from 'better-sqlite3'
import { app } from 'electron'
import path from 'node:path'

import * as schema from './schema'

function getDatabasePath(): string {
  const isDevelopment = !app?.isPackaged

  if (isDevelopment) {
    return path.join(process.cwd(), 'pull-panda.db')
  }

  return path.join(app.getPath('userData'), 'pull-panda.db')
}

let database: ReturnType<typeof drizzle> | null = null

export function getDatabase() {
  if (!database) {
    const databasePath = getDatabasePath()
    const sqlite = new Database(databasePath)

    database = drizzle(sqlite, { schema })

    initializeSchema(sqlite)
  }

  return database
}

function initializeSchema(sqlite: Database.Database): void {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS pull_requests (
      id TEXT PRIMARY KEY,
      number INTEGER NOT NULL,
      title TEXT NOT NULL,
      state TEXT NOT NULL,
      url TEXT NOT NULL,
      repository_owner TEXT NOT NULL,
      repository_name TEXT NOT NULL,
      author_login TEXT,
      author_avatar_url TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      closed_at TEXT,
      merged_at TEXT,
      is_author INTEGER NOT NULL DEFAULT 0,
      is_assignee INTEGER NOT NULL DEFAULT 0,
      is_reviewer INTEGER NOT NULL DEFAULT 0,
      labels TEXT,
      assignees TEXT,
      synced_at TEXT NOT NULL
    )
  `)

  sqlite.exec(`
    CREATE INDEX IF NOT EXISTS idx_pr_state ON pull_requests(state);
    CREATE INDEX IF NOT EXISTS idx_pr_updated ON pull_requests(updated_at);
    CREATE INDEX IF NOT EXISTS idx_pr_repo ON pull_requests(repository_owner, repository_name);
  `)
}

export function closeDatabase(): void {
  database = null
}
