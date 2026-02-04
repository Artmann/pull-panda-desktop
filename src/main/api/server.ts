import http, { IncomingMessage, Server, ServerResponse } from 'node:http'
import { AddressInfo } from 'node:net'

import { Hono } from 'hono'
import { cors } from 'hono/cors'
import type { ContentfulStatusCode } from 'hono/utils/http-status'

import { BackendError } from './errors'
import { checksRoute } from './routes/checks'
import { commentsRoute, type AppEnv } from './routes/comments'
import { pullRequestsRoute } from './routes/pull-requests'
import { reviewsRoute } from './routes/reviews'
import { syncsRoute } from './routes/syncs'

let server: Server | null = null
let apiPort: number | null = null

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
        allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowHeaders: ['Content-Type']
      })
    )

    app.use('*', async (context, next) => {
      const token = getToken()

      if (!token) {
        return context.json({ error: 'Not authenticated' }, 401)
      }

      context.set('token', token)
      await next()
    })

    app.route('/api/checks', checksRoute)
    app.route('/api/comments', commentsRoute)
    app.route('/api/pull-requests', pullRequestsRoute)
    app.route('/api/reviews', reviewsRoute)
    app.route('/api/syncs', syncsRoute)

    app.get('/api/health', (context) => {
      return context.json({ status: 'ok' })
    })

    app.onError((error, context) => {
      const statusCode = error instanceof BackendError ? error.statusCode : 500
      const message = error instanceof Error ? error.message : 'Unknown error'

      console.error('API Error:', error)

      return context.json(
        { error: { message } },
        statusCode as ContentfulStatusCode
      )
    })

    try {
      server = http.createServer(async (request: IncomingMessage, response: ServerResponse) => {
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
      })

      server.listen(0, () => {
        if (!server) {
          return reject(new Error('Server was unexpectedly null'))
        }

        const address = server.address() as AddressInfo
        apiPort = address.port

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
  if (server) {
    server.close()
    server = null
    apiPort = null
    console.log('API server stopped')
  }
}
