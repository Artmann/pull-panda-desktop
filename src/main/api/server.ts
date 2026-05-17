import fs from 'node:fs'
import http, { IncomingMessage, Server, ServerResponse } from 'node:http'
import path from 'node:path'
import { AddressInfo } from 'node:net'

import { app as electronApp } from 'electron'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import type { ContentfulStatusCode } from 'hono/utils/http-status'

import { type AppEnv } from './effect-handler'
import { getApiMainWindow, setApiMainWindow } from './main-window-ref'
import { checksRoute } from './routes/checks'
import { commentsRoute } from './routes/comments'
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
