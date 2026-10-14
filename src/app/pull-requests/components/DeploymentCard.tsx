import { ArrowUpRightIcon } from 'lucide-react'
import { memo, type ReactElement } from 'react'

import { cn } from '@/app/lib/utils'

import type { VercelDeployment } from './vercel-deployments'

type DeploymentTone = 'danger' | 'neutral' | 'success' | 'warning'

function getTone(status: string): DeploymentTone {
  const normalized = status.toLowerCase()

  if (normalized.includes('ready')) {
    return 'success'
  }

  if (normalized.includes('error') || normalized.includes('fail')) {
    return 'danger'
  }

  if (normalized.includes('cancel') || normalized.includes('ignored')) {
    return 'neutral'
  }

  return 'warning'
}

const dotClassNames: Record<DeploymentTone, string> = {
  danger: 'bg-status-danger-foreground',
  neutral: 'bg-muted-foreground',
  success: 'bg-status-success-foreground',
  warning: 'bg-status-warning-foreground'
}

const statusClassNames: Record<DeploymentTone, string> = {
  danger: 'text-status-danger-foreground',
  neutral: 'text-muted-foreground',
  success: 'text-status-success-foreground',
  warning: 'text-status-warning-foreground'
}

/** One line per preview deployment, in place of the bot's markdown table. */
export const DeploymentCard = memo(function DeploymentCard({
  deployments
}: {
  deployments: VercelDeployment[]
}): ReactElement {
  return (
    <div className="flex flex-col rounded-lg border border-border bg-card text-xs">
      {deployments.map((deployment) => {
        const tone = getTone(deployment.status)
        const previewUrl = deployment.previewUrl

        return (
          <div
            className="flex items-center gap-3.5 border-t border-border px-3.5 py-2.5 first:border-t-0"
            key={deployment.project}
          >
            <span
              aria-hidden
              className={cn('size-2 shrink-0 rounded-full', dotClassNames[tone])}
            />

            <span className="font-medium text-foreground">
              {deployment.project}
            </span>

            <span className={statusClassNames[tone]}>{deployment.status}</span>

            <span className="min-w-0 flex-1 truncate text-muted-foreground">
              {deployment.updated}
            </span>

            {previewUrl && (
              <button
                className="flex shrink-0 cursor-pointer items-center gap-0.5 text-primary hover:underline"
                onClick={() => {
                  window.electron.openUrl(previewUrl)
                }}
                type="button"
              >
                Open preview
                <ArrowUpRightIcon className="size-3" />
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
})
