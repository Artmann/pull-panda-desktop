import { describe, expect, it } from 'vitest'

import type { AgentRunRequest } from '../types'
import { claudeAdapter } from './claude'

const runRequest: AgentRunRequest = {
  binaryPath: 'C:\\tools\\claude.cmd',
  cwd: 'C:\\repos\\demo',
  mcp: { token: 'secret', url: 'http://127.0.0.1:4242/api/mcp' },
  resumeSessionId: null,
  systemPrompt: 'You are helping with PR #7.',
  userMessage: 'What does this PR change?'
}

describe('claudeAdapter.buildCommand', () => {
  it('builds a first-run command with mcp config and system prompt', () => {
    const command = claudeAdapter.buildCommand(runRequest)

    expect(command).toEqual({
      args: [
        '-p',
        '--output-format',
        'stream-json',
        '--verbose',
        '--mcp-config',
        JSON.stringify({
          mcpServers: {
            pullpanda: {
              headers: { Authorization: 'Bearer secret' },
              type: 'http',
              url: 'http://127.0.0.1:4242/api/mcp'
            }
          }
        }),
        '--strict-mcp-config',
        '--allowedTools',
        'mcp__pullpanda',
        '--append-system-prompt',
        'You are helping with PR #7.'
      ],
      stdinPayload: 'What does this PR change?'
    })
  })

  it('adds --resume and drops the system prompt on later runs', () => {
    const command = claudeAdapter.buildCommand({
      ...runRequest,
      resumeSessionId: 'session-1',
      systemPrompt: null
    })

    expect(command.args).toContain('--resume')
    expect(command.args).toContain('session-1')
    expect(command.args).not.toContain('--append-system-prompt')
  })
})

describe('claudeAdapter.parseLine', () => {
  it('extracts the session id from the init event', () => {
    const line = JSON.stringify({
      type: 'system',
      subtype: 'init',
      session_id: 'abc-123',
      tools: []
    })

    expect(claudeAdapter.parseLine(line)).toEqual([
      { agentSessionId: 'abc-123', kind: 'agent-session' }
    ])
  })

  it('extracts text and tool calls from assistant events', () => {
    const line = JSON.stringify({
      type: 'assistant',
      message: {
        content: [
          { type: 'text', text: 'Let me look at the files.' },
          {
            type: 'tool_use',
            name: 'mcp__pullpanda__list_files',
            input: { pullRequestId: 'PR_1' }
          }
        ]
      },
      session_id: 'abc-123'
    })

    expect(claudeAdapter.parseLine(line)).toEqual([
      { kind: 'assistant-text', text: 'Let me look at the files.' },
      {
        detail: '{"pullRequestId":"PR_1"}',
        kind: 'tool-call',
        name: 'mcp__pullpanda__list_files'
      }
    ])
  })

  it('extracts the final result', () => {
    const line = JSON.stringify({
      type: 'result',
      subtype: 'success',
      is_error: false,
      result: 'This PR adds a chat tab.'
    })

    expect(claudeAdapter.parseLine(line)).toEqual([
      { isError: false, kind: 'result', text: 'This PR adds a chat tab.' }
    ])
  })

  it('ignores unknown and malformed lines', () => {
    expect(claudeAdapter.parseLine('not json')).toEqual([])
    expect(claudeAdapter.parseLine('{"type":"user"}')).toEqual([])
  })
})
