import fs from 'node:fs'
import http, { IncomingMessage, Server, ServerResponse } from 'node:http'
import path from 'node:path'
import { AddressInfo } from 'node:net'

import { app as electronApp } from 'electron'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import type { ContentfulStatusCode } from 'hono/utils/http-status'

import {
  childContext,
  parentSpanIdHeader,
  startSpan,
  traceIdHeader
} from '../../telemetry/span'
import { type AppEnv } from './effect-handler'
import { getApiMainWindow, setApiMainWindow } from './main-window-ref'
import { getMcpToken } from './mcp-token'
import { checksRoute } from './routes/checks'
import { commentsRoute } from './routes/comments'
import { mcpRoute } from './routes/mcp'
import { navigateRoute } from './routes/navigate'
import { pullRequestsRoute } from './routes/pull-requests'
import { repoCheckoutRoute } from './routes/repo-checkout'
import { reposRoute } from './routes/repos'
import { reviewsRoute } from './routes/reviews'
import { reviewThreadsRoute } from './routes/review-threads'
import { screenshotRoute } from './routes/screenshot'
import { syncsRoute } from './routes/syncs'

let server: Server | null = null
let apiPort: number | null = null

export { getApiMainWindow, setApiMainWindow }

export function getApiPort(): number | null {
  return apiPort
}

export function startApiServer(getToken: () => string | null): Promise<number> {
  return new Promise((resolve, reject) => {
    const app = new Hono<AppEnv>()

    app.use(
      '*',
      cors({
        origin: '*',
        allowMethods: ['DELETE', 'GET', 'OPTIONS', 'PATCH', 'POST', 'PUT'],
        // The renderer is cross-origin to the local API server, so the trace
        // context headers added by `tracedFetch` must be allowed or the CORS
        // preflight blocks every request.
        allowHeaders: ['Content-Type', traceIdHeader, parentSpanIdHeader]
      })
    )

    app.use('*', async (context, next) => {
      const token = getToken()

      // The MCP endpoint is called by a spawned agent process that has no
      // GitHub token; it authenticates with the per-launch bearer token
      // below instead. The GitHub token is still attached when present so
      // MCP tools that reach GitHub can use it.
      if (context.req.path.startsWith('/api/mcp')) {
        if (token) {
          context.set('token', token)
        }

        return next()
      }

      if (!token) {
        return context.json({ error: 'Not authenticated' }, 401)
      }

      context.set('token', token)
      await next()
    })

    app.use('/api/mcp/*', async (context, next) => {
      const authorization = context.req.header('Authorization')

      if (authorization !== `Bearer ${getMcpToken()}`) {
        return context.json({ error: 'Unauthorized' }, 401)
      }

      await next()
    })

    // Open a span per request, parented to the renderer span when the trace
    // context headers are present, and expose its child context so the route's
    // Effect work nests under it (see `effectHandler`).
    app.use('*', async (context, next) => {
      const traceId = context.req.header(traceIdHeader)
      const parentSpanId = context.req.header(parentSpanIdHeader)
      const span = startSpan(`http ${context.req.method} ${context.req.path}`, {
        kind: 'server',
        attributes: {
          'http.method': context.req.method,
          'http.path': context.req.path
        },
        parent: traceId && parentSpanId ? { traceId, parentSpanId } : null
      })

      context.set('traceContext', childContext(span))

      try {
        await next()

        span.setAttribute('http.status', context.res.status)

        if (context.res.status >= 500) {
          span.setStatus('error', `HTTP ${context.res.status}`)
        }
      } catch (error) {
        span.setStatus(
          'error',
          error instanceof Error ? error.message : String(error)
        )

        throw error
      } finally {
        span.end()
      }
    })

    app.route('/api/checks', checksRoute)
    app.route('/api/comments', commentsRoute)
    app.route('/api/mcp', mcpRoute)
    app.route('/api/navigate', navigateRoute)
    app.route('/api/pull-requests', pullRequestsRoute)
    app.route('/api/repo-checkout', repoCheckoutRoute)
    app.route('/api/repos', reposRoute)
    app.route('/api/reviews', reviewsRoute)
    app.route('/api/review-threads', reviewThreadsRoute)
    app.route('/api/screenshot', screenshotRoute)
    app.route('/api/syncs', syncsRoute)

    app.get('/api/health', (context) => {
      return context.json({ status: 'ok' })
    })

    // Routes use the Effect-aware handler in `./effect-handler.ts` to map
    // tagged errors to HTTP responses. Anything reaching `onError` is either
    // a Hono middleware fault or a thrown exception — treat it as 500.
    app.onError((error, context) => {
      const message = error instanceof Error ? error.message : 'Unknown error'

      console.error('API Error:', error)

      return context.json({ error: { message } }, 500 as ContentfulStatusCode)
    })

    try {
      server = http.createServer(
        async (request: IncomingMessage, response: ServerResponse) => {
          const url = `http://localhost${request.url}`
          const headers = new Headers()

          for (const [key, value] of Object.entries(request.headers)) {
            if (value) {
              headers.set(key, Array.isArray(value) ? value.join(', ') : value)
            }
          }

          let body: BodyInit | undefined

          if (request.method !== 'GET' && request.method !== 'HEAD') {
            const buffer = await new Promise<Buffer>((resolve) => {
              const chunks: Buffer[] = []
              request.on('data', (chunk) => chunks.push(chunk))
              request.on('end', () => resolve(Buffer.concat(chunks)))
            })

            body = buffer.toString()
          }

          const fetchRequest = new Request(url, {
            method: request.method,
            headers,
            body
          })

          const fetchResponse = await app.fetch(fetchRequest)

          response.statusCode = fetchResponse.status

          fetchResponse.headers.forEach((value, key) => {
            response.setHeader(key, value)
          })

          const responseBody = await fetchResponse.arrayBuffer()
          response.end(Buffer.from(responseBody))
        }
      )

      server.listen(0, () => {
        if (!server) {
          return reject(new Error('Server was unexpectedly null'))
        }

        const address = server.address() as AddressInfo
        apiPort = address.port

        const portFilePath = path.join(
          electronApp.getPath('userData'),
          'api-port'
        )
        fs.writeFileSync(portFilePath, String(apiPort))

        console.log(`API server started on port ${apiPort}`)
        resolve(apiPort)
      })

      server.on('error', reject)
    } catch (error) {
      reject(error)
    }
  })
}

export function stopApiServer(): void {
  const portFilePath = path.join(electronApp.getPath('userData'), 'api-port')

  try {
    fs.unlinkSync(portFilePath)
  } catch {
    // Port file may not exist.
  }

  if (server) {
    server.close()
    server = null
    apiPort = null
    console.log('API server stopped')
  }
}
