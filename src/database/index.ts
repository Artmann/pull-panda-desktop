import { drizzle } from 'drizzle-orm/sql-js'
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

let database: ReturnType<typeof drizzle> | null = null
let sqliteInstance: SqlJsDatabase | null = null
let sqlJsInitialized = false

async function initSqlJsOnce() {
  if (!sqlJsInitialized) {
    await initSqlJs()
    sqlJsInitialized = true
  }
}

export async function initializeDatabase(): Promise<ReturnType<typeof drizzle>> {
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

  initializeAllTables(sqliteInstance)

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

export async function createInMemoryDatabase(): Promise<ReturnType<typeof drizzle>> {
  const SQL = await initSqlJs()
  const sqlite = new SQL.Database()
  const db = drizzle(sqlite, { schema })

  initializeAllTables(sqlite)

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

function initializeAllTables(sqlite: SqlJsDatabase): void {
  sqlite.run(`
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
      body TEXT,
      body_html TEXT,
      is_draft INTEGER NOT NULL DEFAULT 0,
      is_author INTEGER NOT NULL DEFAULT 0,
      is_assignee INTEGER NOT NULL DEFAULT 0,
      is_reviewer INTEGER NOT NULL DEFAULT 0,
      labels TEXT,
      assignees TEXT,
      synced_at TEXT NOT NULL
    )
  `)

  sqlite.run(`CREATE INDEX IF NOT EXISTS idx_pr_state ON pull_requests(state)`)
  sqlite.run(`CREATE INDEX IF NOT EXISTS idx_pr_updated ON pull_requests(updated_at)`)
  sqlite.run(`CREATE INDEX IF NOT EXISTS idx_pr_repo ON pull_requests(repository_owner, repository_name)`)

  // Add columns for existing databases that don't have them yet.
  tryAddColumn(sqlite, 'pull_requests', 'body', 'TEXT')
  tryAddColumn(sqlite, 'pull_requests', 'body_html', 'TEXT')
  tryAddColumn(sqlite, 'pull_requests', 'is_draft', 'INTEGER NOT NULL DEFAULT 0')
  tryAddColumn(sqlite, 'pull_requests', 'details_synced_at', 'TEXT')

  sqlite.run(`
    CREATE TABLE IF NOT EXISTS reviews (
      id TEXT PRIMARY KEY,
      github_id TEXT NOT NULL,
      pull_request_id TEXT NOT NULL,
      state TEXT NOT NULL,
      body TEXT,
      body_html TEXT,
      url TEXT,
      author_login TEXT,
      author_avatar_url TEXT,
      github_created_at TEXT,
      github_submitted_at TEXT,
      synced_at TEXT NOT NULL,
      deleted_at TEXT
    )
  `)
  sqlite.run(`CREATE INDEX IF NOT EXISTS idx_reviews_pull_request_id ON reviews(pull_request_id)`)

  sqlite.run(`
    CREATE TABLE IF NOT EXISTS comments (
      id TEXT PRIMARY KEY,
      github_id TEXT NOT NULL,
      github_numeric_id INTEGER,
      pull_request_id TEXT NOT NULL,
      review_id TEXT,
      body TEXT,
      body_html TEXT,
      path TEXT,
      line INTEGER,
      original_line INTEGER,
      diff_hunk TEXT,
      commit_id TEXT,
      original_commit_id TEXT,
      github_review_id TEXT,
      github_review_thread_id TEXT,
      parent_comment_github_id TEXT,
      user_login TEXT,
      user_avatar_url TEXT,
      url TEXT,
      github_created_at TEXT,
      github_updated_at TEXT,
      synced_at TEXT NOT NULL,
      deleted_at TEXT
    )
  `)
  sqlite.run(`CREATE INDEX IF NOT EXISTS idx_comments_pull_request_id ON comments(pull_request_id)`)

  // Add columns for existing databases
  tryAddColumn(sqlite, 'comments', 'body_html', 'TEXT')
  tryAddColumn(sqlite, 'comments', 'github_numeric_id', 'INTEGER')
  tryAddColumn(sqlite, 'reviews', 'body_html', 'TEXT')

  sqlite.run(`
    CREATE TABLE IF NOT EXISTS comment_reactions (
      id TEXT PRIMARY KEY,
      github_id TEXT NOT NULL,
      comment_id TEXT NOT NULL,
      pull_request_id TEXT NOT NULL,
      content TEXT NOT NULL,
      user_login TEXT,
      user_id TEXT,
      synced_at TEXT NOT NULL,
      deleted_at TEXT
    )
  `)
  sqlite.run(`CREATE INDEX IF NOT EXISTS idx_comment_reactions_comment_id ON comment_reactions(comment_id)`)

  sqlite.run(`
    CREATE TABLE IF NOT EXISTS checks (
      id TEXT PRIMARY KEY,
      github_id TEXT NOT NULL,
      pull_request_id TEXT NOT NULL,
      name TEXT NOT NULL,
      state TEXT,
      conclusion TEXT,
      commit_sha TEXT,
      suite_name TEXT,
      duration_in_seconds INTEGER,
      details_url TEXT,
      message TEXT,
      url TEXT,
      github_created_at TEXT,
      github_updated_at TEXT,
      synced_at TEXT NOT NULL,
      deleted_at TEXT
    )
  `)
  sqlite.run(`CREATE INDEX IF NOT EXISTS idx_checks_pull_request_id ON checks(pull_request_id)`)

  sqlite.run(`
    CREATE TABLE IF NOT EXISTS commits (
      id TEXT PRIMARY KEY,
      github_id TEXT NOT NULL,
      pull_request_id TEXT NOT NULL,
      hash TEXT NOT NULL,
      message TEXT,
      url TEXT,
      author_login TEXT,
      author_avatar_url TEXT,
      lines_added INTEGER,
      lines_removed INTEGER,
      github_created_at TEXT,
      synced_at TEXT NOT NULL,
      deleted_at TEXT
    )
  `)
  sqlite.run(`CREATE INDEX IF NOT EXISTS idx_commits_pull_request_id ON commits(pull_request_id)`)

  sqlite.run(`
    CREATE TABLE IF NOT EXISTS modified_files (
      id TEXT PRIMARY KEY,
      pull_request_id TEXT NOT NULL,
      filename TEXT NOT NULL,
      file_path TEXT NOT NULL,
      status TEXT,
      additions INTEGER,
      deletions INTEGER,
      changes INTEGER,
      diff_hunk TEXT,
      synced_at TEXT NOT NULL,
      deleted_at TEXT
    )
  `)
  sqlite.run(`CREATE INDEX IF NOT EXISTS idx_modified_files_pull_request_id ON modified_files(pull_request_id)`)

  sqlite.run(`
    CREATE TABLE IF NOT EXISTS etags (
      id TEXT PRIMARY KEY,
      endpoint_type TEXT NOT NULL,
      resource_id TEXT NOT NULL,
      etag TEXT NOT NULL,
      last_modified TEXT,
      validated_at TEXT NOT NULL
    )
  `)
  sqlite.run(`CREATE INDEX IF NOT EXISTS idx_etags_endpoint_resource ON etags(endpoint_type, resource_id)`)
}

function tryAddColumn(sqlite: SqlJsDatabase, table: string, column: string, type: string): void {
  try {
    sqlite.run(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`)
  } catch {
    // Column already exists
  }
}

export function closeDatabase(): void {
  if (sqliteInstance) {
    saveDatabase()
    sqliteInstance.close()
    sqliteInstance = null
  }

  database = null
}
