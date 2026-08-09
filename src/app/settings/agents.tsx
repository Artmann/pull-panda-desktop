import { useEffect, useState, type ReactElement } from 'react'
import { toast } from 'sonner'

import { runOptimisticMutation } from '@/app/lib/mutations/run-optimistic-mutation'
import type { DetectedAgent } from '@/main/agents/agent-detection'
import type { AgentId, AgentSettings } from '@/main/agents/agent-settings'

import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Card, CardContent } from '../components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '../components/ui/select'

const comingSoonAgents = ['Cursor Agent', 'OpenCode']

export function AgentsSettings(): ReactElement {
  const [agents, setAgents] = useState<DetectedAgent[] | null>(null)
  const [settings, setSettings] = useState<AgentSettings | null>(null)

  useEffect(function loadAgents() {
    window.agents
      .detect()
      .then(setAgents)
      .catch(() => setAgents([]))

    window.agents
      .getSettings()
      .then(setSettings)
      .catch(() => {
        // Leave settings unloaded; the controls stay disabled.
      })
  }, [])

  const refreshAgents = () => {
    window.agents
      .detect()
      .then(setAgents)
      .catch(() => {
        // Keep the previous list.
      })
  }

  const handleChooseBinary = (agent: AgentId) => {
    window.agents
      .pickBinary()
      .then(({ path }) => {
        if (!path) {
          return
        }

        return window.agents.setOverride(agent, path).then((updated) => {
          setSettings(updated)
          refreshAgents()
        })
      })
      .catch(() => {
        toast.error('Could not set the agent binary.')
      })
  }

  const handleClearOverride = (agent: AgentId) => {
    window.agents
      .setOverride(agent, null)
      .then((updated) => {
        setSettings(updated)
        refreshAgents()
      })
      .catch(() => {
        toast.error('Could not clear the agent binary override.')
      })
  }

  const handleDefaultAgentChange = (value: string) => {
    const previous = settings
    const nextDefault = value === 'auto' ? null : (value as AgentId)

    runOptimisticMutation({
      errorMessage: 'Could not update the default agent.',
      optimistic: () => {
        setSettings((current) =>
          current ? { ...current, defaultAgent: nextDefault } : current
        )
      },
      request: () => window.agents.setDefault(nextDefault),
      commit: setSettings,
      rollback: () => setSettings(previous)
    })
  }

  return (
    <div>
      <h2 className="text-xl font-medium mb-6">Agents</h2>

      <Card className="pt-0">
        <CardContent>
          {(agents ?? []).map((agent) => (
            <div
              key={agent.id}
              className="flex items-center justify-between gap-8 py-6 border-b border-border"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2 font-medium">
                  {agent.displayName}
                  {agent.version && (
                    <Badge variant="secondary">{agent.version}</Badge>
                  )}
                  {agent.source === 'override' && (
                    <Badge variant="outline">Custom path</Badge>
                  )}
                </div>

                <div className="text-muted-foreground text-sm truncate">
                  {agent.path ?? 'Not found on this machine'}
                </div>
              </div>

              <div className="flex shrink-0 gap-2">
                {agent.source === 'override' && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleClearOverride(agent.id)}
                  >
                    Clear
                  </Button>
                )}

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleChooseBinary(agent.id)}
                >
                  Choose binary…
                </Button>
              </div>
            </div>
          ))}

          <div className="flex items-center justify-between gap-8 py-6 border-b border-border">
            <div>
              <div className="font-medium">Default agent</div>
              <div className="text-muted-foreground text-sm">
                Used for new chats. Auto picks the first agent found on this
                machine.
              </div>
            </div>

            <Select
              disabled={settings === null}
              value={settings?.defaultAgent ?? 'auto'}
              onValueChange={handleDefaultAgentChange}
            >
              <SelectTrigger
                className="w-40"
                size="sm"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Auto</SelectItem>
                {(agents ?? []).map((agent) => (
                  <SelectItem
                    key={agent.id}
                    value={agent.id}
                  >
                    {agent.displayName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="py-6">
            <div className="font-medium">Coming soon</div>
            <div className="text-muted-foreground text-sm">
              {comingSoonAgents.join(', ')}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
