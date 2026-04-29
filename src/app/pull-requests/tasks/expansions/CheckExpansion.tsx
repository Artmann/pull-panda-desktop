import { ExternalLinkIcon } from 'lucide-react'
import type { ReactElement } from 'react'

import { Button } from '@/app/components/ui/button'

import type { CheckTask } from '../task-types'

interface CheckExpansionProps {
  task: CheckTask
}

export function CheckExpansion({ task }: CheckExpansionProps): ReactElement {
  return (
    <div className="flex flex-col gap-3 rounded-md border border-border bg-card p-3">
      {task.message ? (
        <pre className="overflow-x-auto rounded-sm bg-muted p-3 font-mono text-xs leading-relaxed text-foreground/80 whitespace-pre-wrap">
          {task.message}
        </pre>
      ) : (
        <div className="text-xs text-muted-foreground">
          No additional details were reported by this check.
        </div>
      )}

      {task.detailsUrl && (
        <div className="flex">
          <Button
            onClick={() => {
              if (task.detailsUrl) {
                window.electron.openUrl(task.detailsUrl)
              }
            }}
            size="sm"
            variant="outline"
          >
            <ExternalLinkIcon className="size-3" />
            View full logs
          </Button>
        </div>
      )}
    </div>
  )
}
