import { randomUUID } from 'node:crypto'

import { and, desc, eq, isNull } from 'drizzle-orm'
import type { SQLJsDatabase } from 'drizzle-orm/sql-js'

import {
  chatMessages,
  chatSessions,
  type ChatMessage,
  type ChatSession
} from '../../database/schema'

type ChatDatabase = SQLJsDatabase<Record<string, unknown>>

const sessionTitleLength = 80

export interface CreateSessionParams {
  agent: string
  pullRequestId: string
  title: string
}

export interface InsertMessageParams {
  content: string
  errorMessage?: string | null
  eventsJson?: string | null
  pullRequestId: string
  role: 'assistant' | 'user'
  sessionId: string
}

export function createSession(
  database: ChatDatabase,
  params: CreateSessionParams
): ChatSession {
  const now = new Date().toISOString()
  const session: ChatSession = {
    id: randomUUID(),
    pullRequestId: params.pullRequestId,
    agent: params.agent,
    agentSessionId: null,
    title: params.title.slice(0, sessionTitleLength),
    createdAt: now,
    updatedAt: now,
    deletedAt: null
  }

  database.insert(chatSessions).values(session).run()

  return session
}

export function getMessages(
  database: ChatDatabase,
  sessionId: string
): ChatMessage[] {
  return database
    .select()
    .from(chatMessages)
    .where(
      and(eq(chatMessages.sessionId, sessionId), isNull(chatMessages.deletedAt))
    )
    .orderBy(chatMessages.createdAt)
    .all()
}

export function getSession(
  database: ChatDatabase,
  sessionId: string
): ChatSession | null {
  const rows = database
    .select()
    .from(chatSessions)
    .where(eq(chatSessions.id, sessionId))
    .all()

  return rows[0] ?? null
}

export function getSessions(
  database: ChatDatabase,
  pullRequestId: string
): ChatSession[] {
  return database
    .select()
    .from(chatSessions)
    .where(
      and(
        eq(chatSessions.pullRequestId, pullRequestId),
        isNull(chatSessions.deletedAt)
      )
    )
    .orderBy(desc(chatSessions.updatedAt))
    .all()
}

export function insertMessage(
  database: ChatDatabase,
  params: InsertMessageParams
): ChatMessage {
  const message: ChatMessage = {
    id: randomUUID(),
    sessionId: params.sessionId,
    pullRequestId: params.pullRequestId,
    role: params.role,
    content: params.content,
    eventsJson: params.eventsJson ?? null,
    errorMessage: params.errorMessage ?? null,
    createdAt: new Date().toISOString(),
    deletedAt: null
  }

  database.insert(chatMessages).values(message).run()

  return message
}

export function touchSession(database: ChatDatabase, sessionId: string): void {
  database
    .update(chatSessions)
    .set({ updatedAt: new Date().toISOString() })
    .where(eq(chatSessions.id, sessionId))
    .run()
}

export function updateSessionAgentSessionId(
  database: ChatDatabase,
  sessionId: string,
  agentSessionId: string
): void {
  database
    .update(chatSessions)
    .set({ agentSessionId })
    .where(eq(chatSessions.id, sessionId))
    .run()
}
