// In development the app runs from node_modules/electron/dist/Electron.app.
// macOS takes the dock tooltip and Cmd+Tab name from that bundle, so
// app.setName() in main.ts cannot change it. This postinstall step makes the
// dev bundle match packaged builds:
//
// 1. It sets CFBundleName and CFBundleDisplayName to "Pull Panda".
// 2. It renames the bundle folder to "Pull Panda.app". macOS only shows the
//    display name when it matches the folder name, so the plist change alone
//    still shows "Electron".
// 3. It points electron/path.txt (which `require('electron')` reads to find
//    the binary) at the renamed bundle.
//
// It re-runs after every install (which is when the Electron bundle is
// recreated) and is a no-op on non-macOS.

import { execFileSync } from 'node:child_process'
import { existsSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'

const applicationName = 'Pull Panda'
const originalBundleName = 'Electron.app'
const renamedBundleName = `${applicationName}.app`

if (process.platform !== 'darwin') {
  process.exit(0)
}

const require = createRequire(import.meta.url)

let electronPackagePath

try {
  electronPackagePath = path.dirname(require.resolve('electron/package.json'))
} catch {
  // Electron isn't installed yet; nothing to rename.
  process.exit(0)
}

const distPath = path.join(electronPackagePath, 'dist')
const originalBundlePath = path.join(distPath, originalBundleName)
const bundlePath = path.join(distPath, renamedBundleName)

// A fresh Electron install extracts a new Electron.app. Replace any bundle
// left over from an earlier rename with it.
if (existsSync(originalBundlePath)) {
  rmSync(bundlePath, { force: true, recursive: true })
  renameSync(originalBundlePath, bundlePath)
}

if (!existsSync(bundlePath)) {
  process.exit(0)
}

const infoPlistPath = path.join(bundlePath, 'Contents', 'Info.plist')

for (const key of ['CFBundleName', 'CFBundleDisplayName']) {
  execFileSync('plutil', [
    '-replace',
    key,
    '-string',
    applicationName,
    infoPlistPath
  ])
}

writeFileSync(
  path.join(electronPackagePath, 'path.txt'),
  `${renamedBundleName}/Contents/MacOS/Electron`
)

// macOS caches bundle names in the LaunchServices database, so the dock can
// keep showing the stale name until the bundle is re-registered. Force a
// refresh; ignore failures since this is a best-effort cosmetic fix.
const launchServicesRegister =
  '/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister'

try {
  execFileSync(launchServicesRegister, ['-f', bundlePath])
} catch {
  // lsregister isn't critical; the rename still applies on next launch.
}

console.log(`Renamed dev Electron bundle to "${renamedBundleName}".`)
