import { execFile } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import {
  agentDisplayNames,
  agentIds,
  type AgentId,
  type AgentSettings
} from './agent-settings'

export interface DetectedAgent {
  displayName: string
  id: AgentId
  path: string | null
  source: 'override' | 'path' | 'well-known' | null
  version: string | null
}

const commandTimeoutInMs = 3000

function runCommand(command: string, args: string[]): Promise<string | null> {
  return new Promise((resolve) => {
    execFile(
      command,
      args,
      { timeout: commandTimeoutInMs, windowsHide: true },
      (error, stdout) => {
        if (error) {
          resolve(null)

          return
        }

        resolve(stdout.trim())
      }
    )
  })
}

async function findOnPath(commandName: string): Promise<string | null> {
  if (process.platform === 'win32') {
    const output = await runCommand('where.exe', [commandName])
    const firstLine = output?.split(/\r?\n/)[0]?.trim()

    return firstLine && firstLine.length > 0 ? firstLine : null
  }

  // A login shell picks up the user's profile PATH, which GUI apps on macOS
  // don't inherit.
  const output = await runCommand('/bin/sh', [
    '-lc',
    `command -v ${commandName}`
  ])

  return output && output.length > 0 ? output : null
}

function wellKnownLocations(commandName: string): string[] {
  const home = os.homedir()

  if (process.platform === 'win32') {
    const appData = process.env.APPDATA ?? path.join(home, 'AppData', 'Roaming')

    return [
      path.join(appData, 'npm', `${commandName}.cmd`),
      path.join(home, '.local', 'bin', `${commandName}.exe`),
      path.join(home, '.local', 'bin', `${commandName}.cmd`)
    ]
  }

  return [
    path.join(home, '.local', 'bin', commandName),
    `/opt/homebrew/bin/${commandName}`,
    `/usr/local/bin/${commandName}`
  ]
}

function findWellKnown(commandName: string): string | null {
  for (const candidate of wellKnownLocations(commandName)) {
    if (fs.existsSync(candidate)) {
      return candidate
    }
  }

  return null
}

async function readVersion(binaryPath: string): Promise<string | null> {
  const needsShell = /\.(cmd|bat)$/i.test(binaryPath)
  const output = needsShell
    ? await runCommand('cmd.exe', ['/c', binaryPath, '--version'])
    : await runCommand(binaryPath, ['--version'])

  return output?.split(/\r?\n/)[0]?.trim() ?? null
}

async function resolveAgentBinaryWithSource(
  id: AgentId,
  settings: AgentSettings
): Promise<{ path: string | null; source: DetectedAgent['source'] }> {
  const override = settings.overrides[id]

  if (override && fs.existsSync(override)) {
    return { path: override, source: 'override' }
  }

  const onPath = await findOnPath(id)

  if (onPath) {
    return { path: onPath, source: 'path' }
  }

  const wellKnown = findWellKnown(id)

  return { path: wellKnown, source: wellKnown ? 'well-known' : null }
}

export async function resolveAgentBinary(
  id: AgentId,
  settings: AgentSettings
): Promise<string | null> {
  const resolved = await resolveAgentBinaryWithSource(id, settings)

  return resolved.path
}

async function detectAgent(
  id: AgentId,
  settings: AgentSettings
): Promise<DetectedAgent> {
  const { path: binaryPath, source } = await resolveAgentBinaryWithSource(
    id,
    settings
  )

  return {
    displayName: agentDisplayNames[id],
    id,
    path: binaryPath,
    source,
    version: binaryPath ? await readVersion(binaryPath) : null
  }
}

export function detectAgents(
  settings: AgentSettings
): Promise<DetectedAgent[]> {
  return Promise.all(agentIds.map((id) => detectAgent(id, settings)))
}
