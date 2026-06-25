import { app } from 'electron'
import path from 'node:path'

import { getTelemetryStore, initializeTelemetryStore } from './store'

// Telemetry is dev-only: it is never initialized in packaged builds, so the
// renderer tracer no-ops and `pull-panda-telemetry.db` is never created for end
// users.

const telemetryDatabaseFileName = 'pull-panda-telemetry.db'

function getTelemetryDatabasePath(): string {
  const isDevelopment = !app.isPackaged

  if (isDevelopment) {
    return path.join(process.cwd(), telemetryDatabaseFileName)
  }

  return path.join(app.getPath('userData'), telemetryDatabaseFileName)
}

function isTelemetryActive(): boolean {
  return !app.isPackaged
}

export async function initializeTelemetry(): Promise<void> {
  if (!isTelemetryActive()) {
    return
  }

  await initializeTelemetryStore(getTelemetryDatabasePath())
}

export function shutdownTelemetry(): void {
  getTelemetryStore()?.close()
}
