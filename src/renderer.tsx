/**
 * This file will automatically be loaded by vite and run in the "renderer" context.
 * To learn more about the differences between the "main" and the "renderer" context in
 * Electron, visit:
 *
 * https://electronjs.org/docs/tutorial/process-model
 *
 * By default, Node.js integration in this file is disabled. When enabling Node.js integration
 * in a renderer process, please be aware of potential security implications. You can read
 * more about security risks here:
 *
 * https://electronjs.org/docs/tutorial/security
 *
 * To enable Node.js integration in this file, open up `main.ts` and enable the `nodeIntegration`
 * flag:
 *
 * ```
 *  // Create the browser window.
 *  mainWindow = new BrowserWindow({
 *    width: 800,
 *    height: 600,
 *    webPreferences: {
 *      nodeIntegration: true
 *    }
 *  });
 * ```
 */

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// eslint-disable-next-line import/no-named-as-default
import posthog from 'posthog-js'
import { PostHogErrorBoundary, PostHogProvider } from '@posthog/react'

import { App } from './app/App'
import { getStoredAnalyticsEnabled } from './app/lib/analytics'
import { filterReadyPullRequests } from './app/lib/pull-requests'
import { createStore } from './app/store'
import './app/index.css'

posthog.init(import.meta.env.VITE_PUBLIC_POSTHOG_PROJECT_TOKEN, {
  api_host: import.meta.env.VITE_PUBLIC_POSTHOG_HOST,
  capture_pageview: false,
  defaults: '2026-01-30',
  disable_session_recording: true,
  opt_out_capturing_by_default: !getStoredAnalyticsEnabled(),
  persistence: 'localStorage'
})

async function main() {
  const bootstrapData = await window.electron.getBootstrapData()
  const readyPullRequests = filterReadyPullRequests(bootstrapData?.pullRequests)

  const store = createStore({
    checks: { items: bootstrapData?.checks ?? [] },
    comments: { items: bootstrapData?.comments ?? [] },
    commits: { items: bootstrapData?.commits ?? [] },
    connectedRepos: {
      byFullName: bootstrapData?.connectedRepos ?? {},
      checkoutsInProgress: {},
      initialized: true
    },
    modifiedFiles: { items: bootstrapData?.modifiedFiles ?? [] },
    pendingReviews: bootstrapData?.pendingReviews ?? {},
    pullRequests: { initialized: true, items: readyPullRequests },
    reactions: { items: bootstrapData?.reactions ?? [] },
    reviews: { items: bootstrapData?.reviews ?? [] },
    reviewThreads: { items: bootstrapData?.reviewThreads ?? [] }
  })

  const root = document.getElementById('root')

  if (!root) {
    throw new Error('Root element not found')
  }

  createRoot(root).render(
    <StrictMode>
      <PostHogProvider client={posthog}>
        <PostHogErrorBoundary>
          <App store={store} />
        </PostHogErrorBoundary>
      </PostHogProvider>
    </StrictMode>
  )
}

main()
