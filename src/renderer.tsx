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

import { createRoot } from 'react-dom/client'

import { App } from './app/App'
import { buildPreloadedState } from './app/lib/bootstrap-state'
import { createStore } from './app/store'
import './app/index.css'

async function main() {
  const bootstrapData = await window.electron.getBootstrapData()
  const store = createStore(buildPreloadedState(bootstrapData))
  const root = document.getElementById('root')

  if (!root) {
    throw new Error('Root element not found')
  }

  // NOTE: StrictMode is intentionally NOT used here. Its dev-only double
  // mounting breaks @pierre/diffs' imperative instance lifecycle: the
  // syntax-highlight worker response is delivered to the first (unmounted)
  // instance, so diffs always render without highlighting in development.
  createRoot(root).render(<App store={store} />)
}

main()
