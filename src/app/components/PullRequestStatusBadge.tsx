import { memo, useMemo, type ReactElement } from 'react'

import { Badge } from '@/app/components/ui/badge'

export const PullRequestStatusBadge = memo(function PullRequestStatusBadge({
  status
}: {
  status?: string
}): ReactElement {
  const variant = useMemo((): 'default' | 'secondary' | 'destructive' => {
    if (!status) {
      return 'default'
    }

    const normalizedStatus = status.toLowerCase()

    if (normalizedStatus === 'closed') {
      return 'destructive'
    }

    if (normalizedStatus === 'merged') {
      return 'default'
    }

    if (normalizedStatus === 'draft') {
      return 'secondary'
    }

    return 'default'
  }, [status])

  const displayText = useMemo(() => {
    if (!status) {
      return 'open'
    }

    return status.toLowerCase()
  }, [status])

  return (
    <Badge
      className="capitalize"
      variant={variant}
    >
      {displayText}
    </Badge>
  )
})
