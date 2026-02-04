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

import { App } from './app/App'
import { filterReadyPullRequests } from './app/lib/pull-requests'
import { createStore } from './app/store'
import './app/index.css'

async function main() {
  const bootstrapData = await window.electron.getBootstrapData()
  const readyPullRequests = filterReadyPullRequests(
    bootstrapData?.pullRequests
  )

  const store = createStore({
    pendingReviews: bootstrapData?.pendingReviews ?? {},
    pullRequestDetails: bootstrapData?.pullRequestDetails ?? {},
    pullRequests: {
      items: readyPullRequests
    }
  })

  const root = document.getElementById('root')

  if (!root) {
    throw new Error('Root element not found')
  }

  createRoot(root).render(
    <StrictMode>
      <App store={store} />
    </StrictMode>
  )
}

main()
