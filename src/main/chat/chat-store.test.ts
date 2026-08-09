import { createRequire } from 'node:module'
import path from 'node:path'

import { drizzle } from 'drizzle-orm/sql-js'
import { migrate } from 'drizzle-orm/sql-js/migrator'
import initSqlJs from 'sql.js'
import { beforeEach, describe, expect, it } from 'vitest'

import * as schema from '../../database/schema'
import {
  createSession,
  getMessages,
  getSession,
  getSessions,
  insertMessage,
  touchSession,
  updateSessionAgentSessionId
} from './chat-store'

type DrizzleDb = ReturnType<typeof drizzle<typeof schema>>

const require = createRequire(import.meta.url)

async function makeInMemoryDatabase(): Promise<DrizzleDb> {
  const sqlJsMain = require.resolve('sql.js')
  const wasmPath = path.join(path.dirname(sqlJsMain), 'sql-wasm.wasm')
  const SQL = await initSqlJs({ locateFile: () => wasmPath })

  const database = drizzle(new SQL.Database(), { schema })

  migrate(database, {
    migrationsFolder: path.join(process.cwd(), 'drizzle')
  })

  return database
}

describe('chat-store', () => {
  let database: DrizzleDb

  beforeEach(async () => {
    database = await makeInMemoryDatabase()
  })

  it('creates a session and finds it by pull request', () => {
    const session = createSession(database, {
      agent: 'claude',
      pullRequestId: 'PR_1',
      title: 'What does this PR change?'
    })

    expect(getSessions(database, 'PR_1')).toEqual([session])
    expect(getSession(database, session.id)).toEqual(session)
  })

  it('truncates long session titles to 80 characters', () => {
    const session = createSession(database, {
      agent: 'claude',
      pullRequestId: 'PR_1',
      title: 'x'.repeat(200)
    })

    expect(session.title).toEqual('x'.repeat(80))
  })

  it('orders sessions by most recently updated', () => {
    const first = createSession(database, {
      agent: 'claude',
      pullRequestId: 'PR_1',
      title: 'first'
    })
    const second = createSession(database, {
      agent: 'codex',
      pullRequestId: 'PR_1',
      title: 'second'
    })

    database
      .update(schema.chatSessions)
      .set({ updatedAt: '2026-01-01T00:00:00.000Z' })
      .run()
    touchSession(database, first.id)

    const sessions = getSessions(database, 'PR_1')

    expect(sessions.map((session) => session.id)).toEqual([first.id, second.id])
  })

  it('stores the agent session id for resume', () => {
    const session = createSession(database, {
      agent: 'claude',
      pullRequestId: 'PR_1',
      title: 'hello'
    })

    updateSessionAgentSessionId(database, session.id, 'agent-session-123')

    expect(getSession(database, session.id)).toEqual({
      ...session,
      agentSessionId: 'agent-session-123'
    })
  })

  it('inserts and reads back messages in order', () => {
    const session = createSession(database, {
      agent: 'claude',
      pullRequestId: 'PR_1',
      title: 'hello'
    })

    const userMessage = insertMessage(database, {
      content: 'hello',
      pullRequestId: 'PR_1',
      role: 'user',
      sessionId: session.id
    })
    const assistantMessage = insertMessage(database, {
      content: 'hi there',
      errorMessage: null,
      eventsJson: '[{"name":"read_pull_request"}]',
      pullRequestId: 'PR_1',
      role: 'assistant',
      sessionId: session.id
    })

    expect(getMessages(database, session.id)).toEqual([
      userMessage,
      assistantMessage
    ])
  })

  it('returns messages only for the requested session', () => {
    const session = createSession(database, {
      agent: 'claude',
      pullRequestId: 'PR_1',
      title: 'hello'
    })
    const otherSession = createSession(database, {
      agent: 'claude',
      pullRequestId: 'PR_1',
      title: 'other'
    })

    insertMessage(database, {
      content: 'other message',
      pullRequestId: 'PR_1',
      role: 'user',
      sessionId: otherSession.id
    })
    const message = insertMessage(database, {
      content: 'mine',
      pullRequestId: 'PR_1',
      role: 'user',
      sessionId: session.id
    })

    expect(getMessages(database, session.id)).toEqual([message])
  })
})
