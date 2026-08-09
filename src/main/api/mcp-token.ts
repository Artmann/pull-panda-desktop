import { randomUUID } from 'node:crypto'

// A per-launch bearer token protecting the MCP endpoint. It is never written
// to disk; it only travels inside the MCP config handed to a spawned agent
// process, so nothing outside this app instance can call the MCP tools.
const mcpToken = randomUUID()

export function getMcpToken(): string {
  return mcpToken
}
