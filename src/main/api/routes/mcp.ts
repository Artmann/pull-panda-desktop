import { app } from 'electron'
import { Hono } from 'hono'
import { StreamableHTTPTransport } from '@hono/mcp'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'

import { type AppEnv } from '../effect-handler'
import { registerPullPandaTools } from '../mcp/tools'

export const mcpRoute = new Hono<AppEnv>()

// Stateless MCP endpoint: each POST carries a complete JSON-RPC exchange and
// gets a plain JSON response. The node:http bridge in server.ts buffers
// response bodies, so SSE streaming would stall — JSON mode avoids it, and a
// fresh server per request avoids session bookkeeping.
mcpRoute.post('/', async (context) => {
  const token = context.get('token') ?? null
  const server = new McpServer({
    name: 'pullpanda',
    version: app.getVersion()
  })

  registerPullPandaTools(server, () => token)

  const transport = new StreamableHTTPTransport({
    enableJsonResponse: true,
    sessionIdGenerator: undefined
  })

  await server.connect(transport)

  const response = await transport.handleRequest(context)

  return response ?? context.body(null, 202)
})
