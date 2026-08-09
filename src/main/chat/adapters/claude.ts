import type {
  AgentAdapter,
  AgentCommand,
  AgentRunRequest,
  ParsedAgentEvent
} from '../types'

interface ClaudeContentBlock {
  input?: unknown
  name?: string
  text?: string
  type?: string
}

interface ClaudeStreamLine {
  is_error?: boolean
  message?: { content?: ClaudeContentBlock[] }
  result?: string
  session_id?: string
  subtype?: string
  type?: string
}

function describeToolInput(input: unknown): string | null {
  if (!input || typeof input !== 'object') {
    return null
  }

  const text = JSON.stringify(input)

  return text === '{}' ? null : text.slice(0, 200)
}

function parseAssistantBlocks(parsed: ClaudeStreamLine): ParsedAgentEvent[] {
  const events: ParsedAgentEvent[] = []

  for (const block of parsed.message?.content ?? []) {
    if (block.type === 'text' && block.text) {
      events.push({ kind: 'assistant-text', text: block.text })
    }

    if (block.type === 'tool_use' && block.name) {
      events.push({
        detail: describeToolInput(block.input),
        kind: 'tool-call',
        name: block.name
      })
    }
  }

  return events
}

function parseResult(parsed: ClaudeStreamLine): ParsedAgentEvent[] {
  return [
    {
      isError: parsed.is_error ?? false,
      kind: 'result',
      text: parsed.result ?? null
    }
  ]
}

function parseSystemInit(parsed: ClaudeStreamLine): ParsedAgentEvent[] {
  if (!parsed.session_id) {
    return []
  }

  return [{ agentSessionId: parsed.session_id, kind: 'agent-session' }]
}

function buildMcpConfig(request: AgentRunRequest): string {
  return JSON.stringify({
    mcpServers: {
      pullpanda: {
        headers: { Authorization: `Bearer ${request.mcp.token}` },
        type: 'http',
        url: request.mcp.url
      }
    }
  })
}

export const claudeAdapter: AgentAdapter = {
  displayName: 'Claude Code',

  id: 'claude',

  buildCommand(request: AgentRunRequest): AgentCommand {
    const args = [
      '-p',
      '--output-format',
      'stream-json',
      '--verbose',
      '--mcp-config',
      buildMcpConfig(request),
      '--strict-mcp-config',
      '--allowedTools',
      'mcp__pullpanda'
    ]

    if (request.resumeSessionId) {
      args.push('--resume', request.resumeSessionId)
    }

    if (request.systemPrompt) {
      args.push('--append-system-prompt', request.systemPrompt)
    }

    return { args, stdinPayload: request.userMessage }
  },

  parseLine(line: string): ParsedAgentEvent[] {
    let parsed: ClaudeStreamLine

    try {
      parsed = JSON.parse(line) as ClaudeStreamLine
    } catch {
      return []
    }

    if (parsed.type === 'system' && parsed.subtype === 'init') {
      return parseSystemInit(parsed)
    }

    if (parsed.type === 'assistant') {
      return parseAssistantBlocks(parsed)
    }

    if (parsed.type === 'result') {
      return parseResult(parsed)
    }

    return []
  }
}
