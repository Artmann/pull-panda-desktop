// In development the app runs from node_modules/electron/dist/Electron.app,
// whose Info.plist reports the name as "Electron". macOS reads the dock tooltip
// and Finder name straight from that plist, so app.setName() in main.ts cannot
// change it. This postinstall step rewrites the dev bundle's name to "Pull
// Panda" so dev matches packaged builds. It re-runs after every install (which
// is when the Electron bundle is recreated) and is a no-op on non-macOS.

import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'

const applicationName = 'Pull Panda'

if (process.platform !== 'darwin') {
  process.exit(0)
}

const require = createRequire(import.meta.url)

let electronDistPath

try {
  electronDistPath = path.dirname(require.resolve('electron/package.json'))
} catch {
  // Electron isn't installed yet; nothing to rename.
  process.exit(0)
}

const infoPlistPath = path.join(
  electronDistPath,
  'dist',
  'Electron.app',
  'Contents',
  'Info.plist'
)

if (!existsSync(infoPlistPath)) {
  process.exit(0)
}

for (const key of ['CFBundleName', 'CFBundleDisplayName']) {
  execFileSync('plutil', [
    '-replace',
    key,
    '-string',
    applicationName,
    infoPlistPath
  ])
}

console.log(`Renamed dev Electron bundle to "${applicationName}".`)
