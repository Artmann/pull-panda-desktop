import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ChatSession } from '../../database/schema'

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn().mockReturnValue('C:\\tmp\\user-data')
  }
}))

vi.mock('../../database', () => ({
  getDatabase: vi.fn().mockReturnValue({})
}))

vi.mock('../agents/agent-detection', () => ({
  resolveAgentBinary: vi.fn()
}))

vi.mock('../agents/agent-settings', async (importOriginal) => {
  const original =
    await importOriginal<typeof import('../agents/agent-settings')>()

  return {
    ...original,
    loadAgentSettings: vi.fn()
  }
})

vi.mock('../api', () => ({
  getApiPort: vi.fn().mockReturnValue(null)
}))

vi.mock('../api/mcp-token', () => ({
  getMcpToken: vi.fn().mockReturnValue('token')
}))

vi.mock('../connected-repos', () => ({
  getRepoPath: vi.fn().mockReturnValue(null)
}))

vi.mock('./chat-store', () => ({
  createSession: vi.fn(),
  getSession: vi.fn(),
  insertMessage: vi.fn(),
  touchSession: vi.fn(),
  updateSessionAgentSessionId: vi.fn()
}))

import { resolveAgentBinary } from '../agents/agent-detection'
import { loadAgentSettings } from '../agents/agent-settings'
import { createSession, getSession } from './chat-store'
import { chatManager } from './chat-manager'

const resolveAgentBinaryMock = vi.mocked(resolveAgentBinary)
const loadAgentSettingsMock = vi.mocked(loadAgentSettings)
const createSessionMock = vi.mocked(createSession)
const getSessionMock = vi.mocked(getSession)

function buildSession(overrides: Partial<ChatSession> = {}): ChatSession {
  return {
    agent: 'claude',
    agentSessionId: null,
    createdAt: '2026-08-07T10:00:00.000Z',
    deletedAt: null,
    id: 'session-1',
    pullRequestId: 'pr-1',
    title: 'What does this PR change?',
    updatedAt: '2026-08-07T10:00:00.000Z',
    ...overrides
  }
}

beforeEach(() => {
  vi.clearAllMocks()

  loadAgentSettingsMock.mockReturnValue({ defaultAgent: null, overrides: {} })
  resolveAgentBinaryMock.mockResolvedValue(null)
})

describe('chatManager', () => {
  describe('send', () => {
    it('rejects when the session does not exist', async () => {
      getSessionMock.mockReturnValue(null)

      await expect(
        chatManager.send({
          message: 'Hello',
          pullRequestId: 'pr-1',
          sessionId: 'missing-session'
        })
      ).rejects.toThrow('Chat session not found.')
    })

    it('rejects when no agent is configured', async () => {
      await expect(
        chatManager.send({
          message: 'Hello',
          pullRequestId: 'pr-1',
          sessionId: null
        })
      ).rejects.toThrow(
        'No agent is configured. Set one up under Settings → Agents.'
      )
    })

    it('rejects when the configured agent binary is missing', async () => {
      loadAgentSettingsMock.mockReturnValue({
        defaultAgent: 'claude',
        overrides: {}
      })
      createSessionMock.mockReturnValue(buildSession())

      await expect(
        chatManager.send({
          message: 'Hello',
          pullRequestId: 'pr-1',
          sessionId: null
        })
      ).rejects.toThrow(
        'The Claude Code binary was not found. Configure it under Settings → Agents.'
      )
    })

    it('reuses the agent of an existing session', async () => {
      getSessionMock.mockReturnValue(buildSession({ agent: 'codex' }))

      await expect(
        chatManager.send({
          message: 'Hello',
          pullRequestId: 'pr-1',
          sessionId: 'session-1'
        })
      ).rejects.toThrow(
        'The Codex binary was not found. Configure it under Settings → Agents.'
      )

      expect(createSessionMock).not.toHaveBeenCalled()
    })
  })

  describe('run lifecycle', () => {
    it('reports no active run for an unknown session', () => {
      expect(chatManager.isRunning('unknown-session')).toEqual(false)
    })

    it('ignores stop calls for unknown sessions', () => {
      expect(() => chatManager.stop('unknown-session')).not.toThrow()
    })
  })
})
