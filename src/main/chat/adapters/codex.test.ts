import { describe, expect, it } from 'vitest'

import type { AgentRunRequest } from '../types'
import { codexAdapter } from './codex'

const runRequest: AgentRunRequest = {
  binaryPath: 'C:\\tools\\codex.exe',
  cwd: 'C:\\repos\\demo',
  mcp: { token: 'secret', url: 'http://127.0.0.1:4242/api/mcp' },
  resumeSessionId: null,
  systemPrompt: 'You are helping with PR #7.',
  userMessage: 'What does this PR change?'
}

describe('codexAdapter.buildCommand', () => {
  it('builds a first-run command that prepends the system prompt', () => {
    const command = codexAdapter.buildCommand(runRequest)

    expect(command).toEqual({
      args: [
        'exec',
        '--json',
        '--skip-git-repo-check',
        '-c',
        'mcp_servers.pullpanda.url="http://127.0.0.1:4242/api/mcp"',
        '-c',
        'mcp_servers.pullpanda.bearer_token="secret"',
        '-'
      ],
      stdinPayload: 'You are helping with PR #7.\n\nWhat does this PR change?'
    })
  })

  it('resumes an existing session without the system prompt', () => {
    const command = codexAdapter.buildCommand({
      ...runRequest,
      resumeSessionId: 'thread-1',
      systemPrompt: null
    })

    expect(command.args.slice(0, 3)).toEqual(['exec', 'resume', 'thread-1'])
    expect(command.stdinPayload).toEqual('What does this PR change?')
  })
})

describe('codexAdapter.parseLine', () => {
  it('extracts the session id from thread.started', () => {
    const line = JSON.stringify({ type: 'thread.started', thread_id: 't-1' })

    expect(codexAdapter.parseLine(line)).toEqual([
      { agentSessionId: 't-1', kind: 'agent-session' }
    ])
  })

  it('extracts the session id from session.created', () => {
    const line = JSON.stringify({ type: 'session.created', session_id: 's-1' })

    expect(codexAdapter.parseLine(line)).toEqual([
      { agentSessionId: 's-1', kind: 'agent-session' }
    ])
  })

  it('extracts assistant text from completed agent messages', () => {
    const line = JSON.stringify({
      type: 'item.completed',
      item: { type: 'agent_message', text: 'This PR adds a chat tab.' }
    })

    expect(codexAdapter.parseLine(line)).toEqual([
      { kind: 'assistant-text', text: 'This PR adds a chat tab.' }
    ])
  })

  it('extracts command executions as tool calls', () => {
    const line = JSON.stringify({
      type: 'item.started',
      item: { type: 'command_execution', command: 'ls src' }
    })

    expect(codexAdapter.parseLine(line)).toEqual([
      { detail: 'ls src', kind: 'tool-call', name: 'shell' }
    ])
  })

  it('extracts turn results', () => {
    expect(
      codexAdapter.parseLine(JSON.stringify({ type: 'turn.completed' }))
    ).toEqual([{ isError: false, kind: 'result', text: null }])

    expect(
      codexAdapter.parseLine(
        JSON.stringify({
          type: 'turn.failed',
          error: { message: 'rate limited' }
        })
      )
    ).toEqual([{ isError: true, kind: 'result', text: 'rate limited' }])
  })

  it('ignores unknown and malformed lines', () => {
    expect(codexAdapter.parseLine('not json')).toEqual([])
    expect(
      codexAdapter.parseLine(JSON.stringify({ type: 'item.updated' }))
    ).toEqual([])
  })
})
