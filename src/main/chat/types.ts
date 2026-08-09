import type { AgentId } from '../agents/agent-settings'

export interface McpConnectionInfo {
  token: string
  url: string
}

export interface AgentRunRequest {
  binaryPath: string
  cwd: string
  mcp: McpConnectionInfo
  resumeSessionId: string | null
  systemPrompt: string | null
  userMessage: string
}

export interface AgentCommand {
  args: string[]
  stdinPayload: string
}

export type ParsedAgentEvent =
  | { agentSessionId: string; kind: 'agent-session' }
  | { kind: 'assistant-text'; text: string }
  | { detail: string | null; kind: 'tool-call'; name: string }
  | { isError: boolean; kind: 'result'; text: string | null }

export interface AgentAdapter {
  buildCommand(request: AgentRunRequest): AgentCommand
  displayName: string
  id: AgentId
  parseLine(line: string): ParsedAgentEvent[]
}
