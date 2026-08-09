import type {
  AgentAdapter,
  AgentCommand,
  AgentRunRequest,
  ParsedAgentEvent
} from '../types'

interface CodexItem {
  command?: string
  text?: string
  title?: string
  type?: string
}

interface CodexStreamLine {
  error?: { message?: string }
  item?: CodexItem
  message?: string
  session_id?: string
  thread_id?: string
  type?: string
}

function parseItemStarted(item: CodexItem): ParsedAgentEvent[] {
  if (item.type === 'command_execution' && item.command) {
    return [
      {
        detail: item.command.slice(0, 200),
        kind: 'tool-call',
        name: 'shell'
      }
    ]
  }

  if (item.type === 'mcp_tool_call') {
    return [
      {
        detail: null,
        kind: 'tool-call',
        name: item.title ?? 'mcp_tool_call'
      }
    ]
  }

  return []
}

function parseSessionStart(parsed: CodexStreamLine): ParsedAgentEvent[] {
  if (parsed.type === 'session.created' && parsed.session_id) {
    return [{ agentSessionId: parsed.session_id, kind: 'agent-session' }]
  }

  if (parsed.type === 'thread.started' && parsed.thread_id) {
    return [{ agentSessionId: parsed.thread_id, kind: 'agent-session' }]
  }

  return []
}

function parseTurnEnd(parsed: CodexStreamLine): ParsedAgentEvent[] {
  if (parsed.type === 'turn.completed') {
    return [{ isError: false, kind: 'result', text: null }]
  }

  if (parsed.type === 'turn.failed' || parsed.type === 'error') {
    return [
      {
        isError: true,
        kind: 'result',
        text: parsed.error?.message ?? parsed.message ?? null
      }
    ]
  }

  return []
}

// Maps the JSONL event stream of `codex exec --json`. Codex has no
// system-prompt flag, so the preamble is prepended to the first user message
// in buildCommand instead.
export const codexAdapter: AgentAdapter = {
  displayName: 'Codex',

  id: 'codex',

  buildCommand(request: AgentRunRequest): AgentCommand {
    const args = ['exec']

    if (request.resumeSessionId) {
      args.push('resume', request.resumeSessionId)
    }

    args.push(
      '--json',
      '--skip-git-repo-check',
      '-c',
      `mcp_servers.pullpanda.url="${request.mcp.url}"`,
      '-c',
      `mcp_servers.pullpanda.bearer_token="${request.mcp.token}"`,
      '-'
    )

    const stdinPayload = request.systemPrompt
      ? `${request.systemPrompt}\n\n${request.userMessage}`
      : request.userMessage

    return { args, stdinPayload }
  },

  parseLine(line: string): ParsedAgentEvent[] {
    let parsed: CodexStreamLine

    try {
      parsed = JSON.parse(line) as CodexStreamLine
    } catch {
      return []
    }

    if (parsed.type === 'item.completed' && parsed.item) {
      if (parsed.item.type === 'agent_message' && parsed.item.text) {
        return [{ kind: 'assistant-text', text: parsed.item.text }]
      }

      return []
    }

    if (parsed.type === 'item.started' && parsed.item) {
      return parseItemStarted(parsed.item)
    }

    return [...parseSessionStart(parsed), ...parseTurnEnd(parsed)]
  }
}
