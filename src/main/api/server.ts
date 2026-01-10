import { serve, ServerType } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { AddressInfo } from 'node:net'

import { checksRoute } from './routes/checks'
import { commentsRoute, type AppEnv } from './routes/comments'
import { reviewsRoute } from './routes/reviews'

let server: ServerType | null = null
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
    app.route('/api/reviews', reviewsRoute)

    app.get('/api/health', (context) => {
      return context.json({ status: 'ok' })
    })

    try {
      server = serve({
        fetch: app.fetch,
        port: 0
      })

      const address = server.address() as AddressInfo
      apiPort = address.port

      console.log(`API server started on port ${apiPort}`)
      resolve(apiPort)
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
