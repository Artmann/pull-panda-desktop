import type { ReactElement } from 'react'

import type { PullRequest } from '@/types/pull-request'

import { BranchSyncActions } from '@/app/pull-requests/components/BranchSyncActions'

import type { RequirementTask } from '../task-types'

interface RequirementExpansionProps {
  pullRequest: PullRequest
  task: RequirementTask
}

export function RequirementExpansion({
  pullRequest,
  task
}: RequirementExpansionProps): ReactElement {
  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-md border border-border bg-card p-3 text-sm leading-relaxed text-foreground/80">
        {task.description}
      </div>

      <BranchSyncActions pullRequest={pullRequest} />
    </div>
  )
}
