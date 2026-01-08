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

    initializeAllTables(sqlite)
  }

  return database
}

export function setDatabase(db: ReturnType<typeof drizzle> | null): void {
  database = db
}

export function createInMemoryDatabase(): ReturnType<typeof drizzle> {
  const sqlite = new Database(':memory:')
  const db = drizzle(sqlite, { schema })

  initializeAllTables(sqlite)

  return db
}

function initializeAllTables(sqlite: Database.Database): void {
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

  sqlite.exec(`
    CREATE INDEX IF NOT EXISTS idx_pr_state ON pull_requests(state);
    CREATE INDEX IF NOT EXISTS idx_pr_updated ON pull_requests(updated_at);
    CREATE INDEX IF NOT EXISTS idx_pr_repo ON pull_requests(repository_owner, repository_name);
  `)

  // Add columns for existing databases that don't have them yet.
  try {
    sqlite.exec(`ALTER TABLE pull_requests ADD COLUMN body TEXT`)
  } catch {
    // Column already exists.
  }

  try {
    sqlite.exec(`ALTER TABLE pull_requests ADD COLUMN body_html TEXT`)
  } catch {
    // Column already exists.
  }

  try {
    sqlite.exec(`ALTER TABLE pull_requests ADD COLUMN is_draft INTEGER NOT NULL DEFAULT 0`)
  } catch {
    // Column already exists.
  }

  sqlite.exec(`
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
    );
    CREATE INDEX IF NOT EXISTS idx_reviews_pull_request_id ON reviews(pull_request_id);
  `)

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS comments (
      id TEXT PRIMARY KEY,
      github_id TEXT NOT NULL,
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
    );
    CREATE INDEX IF NOT EXISTS idx_comments_pull_request_id ON comments(pull_request_id);
  `)

  // Add body_html columns for existing databases that don't have them yet.
  try {
    sqlite.exec(`ALTER TABLE comments ADD COLUMN body_html TEXT`)
  } catch {
    // Column already exists.
  }

  try {
    sqlite.exec(`ALTER TABLE reviews ADD COLUMN body_html TEXT`)
  } catch {
    // Column already exists.
  }

  sqlite.exec(`
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
    );
    CREATE INDEX IF NOT EXISTS idx_comment_reactions_comment_id ON comment_reactions(comment_id);
  `)

  sqlite.exec(`
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
    );
    CREATE INDEX IF NOT EXISTS idx_checks_pull_request_id ON checks(pull_request_id);
  `)

  sqlite.exec(`
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
    );
    CREATE INDEX IF NOT EXISTS idx_commits_pull_request_id ON commits(pull_request_id);
  `)

  sqlite.exec(`
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
    );
    CREATE INDEX IF NOT EXISTS idx_modified_files_pull_request_id ON modified_files(pull_request_id);
  `)
}

export function closeDatabase(): void {
  database = null
}
