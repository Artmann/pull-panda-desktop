import fs from 'node:fs'
import path from 'node:path'

import { app } from 'electron'

export const agentIds = ['claude', 'codex'] as const

export type AgentId = (typeof agentIds)[number]

export const agentDisplayNames: Record<AgentId, string> = {
  claude: 'Claude Code',
  codex: 'Codex'
}

export const comingSoonAgents = ['Cursor Agent', 'OpenCode'] as const

export interface AgentSettings {
  defaultAgent: AgentId | null
  overrides: Partial<Record<AgentId, string>>
}

function getStorePath(): string {
  return path.join(app.getPath('userData'), 'agent-settings.json')
}

function isAgentId(value: unknown): value is AgentId {
  return typeof value === 'string' && agentIds.includes(value as AgentId)
}

export function loadAgentSettings(): AgentSettings {
  const storePath = getStorePath()
  const defaults: AgentSettings = { defaultAgent: null, overrides: {} }

  if (!fs.existsSync(storePath)) {
    return defaults
  }

  try {
    const raw = fs.readFileSync(storePath, 'utf-8')
    const parsed = JSON.parse(raw) as unknown

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return defaults
    }

    const candidate = parsed as Record<string, unknown>
    const overrides: Partial<Record<AgentId, string>> = {}

    if (
      candidate.overrides &&
      typeof candidate.overrides === 'object' &&
      !Array.isArray(candidate.overrides)
    ) {
      for (const [key, value] of Object.entries(candidate.overrides)) {
        if (isAgentId(key) && typeof value === 'string' && value.length > 0) {
          overrides[key] = value
        }
      }
    }

    return {
      defaultAgent: isAgentId(candidate.defaultAgent)
        ? candidate.defaultAgent
        : null,
      overrides
    }
  } catch {
    return defaults
  }
}

function saveAgentSettings(settings: AgentSettings): void {
  fs.writeFileSync(getStorePath(), JSON.stringify(settings, null, 2), 'utf-8')
}

export function setAgentOverride(
  agent: AgentId,
  binaryPath: string | null
): AgentSettings {
  const settings = loadAgentSettings()

  if (binaryPath) {
    settings.overrides[agent] = binaryPath
  } else {
    delete settings.overrides[agent]
  }

  saveAgentSettings(settings)

  return settings
}

export function setDefaultAgent(agent: AgentId | null): AgentSettings {
  const settings = loadAgentSettings()
  settings.defaultAgent = agent
  saveAgentSettings(settings)

  return settings
}
