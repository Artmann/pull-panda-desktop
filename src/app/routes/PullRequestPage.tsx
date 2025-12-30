import { ArrowLeft } from 'lucide-react'
import { type ReactElement } from 'react'
import { Link, useParams } from 'react-router'

import { Button } from '@/app/components/ui/button'
import { useAppSelector } from '@/app/store/hooks'

export function PullRequestPage(): ReactElement {
  const { id } = useParams<{ id: string }>()
  const pullRequest = useAppSelector((state) =>
    state.pullRequests.items.find((pr) => pr.id === id)
  )

  if (!pullRequest) {
    return (
      <div className="container mx-auto py-8 px-4">
        <Link to="/">
          <Button variant="ghost" size="sm" className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </Link>

        <div className="text-center text-muted-foreground py-12">
          <p>Pull request not found.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <Link to="/">
        <Button variant="ghost" size="sm" className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
      </Link>

      <div className="mb-4">
        <span className="text-sm text-muted-foreground">
          {pullRequest.repositoryOwner}/{pullRequest.repositoryName}#
          {pullRequest.number}
        </span>
      </div>

      <h1 className="text-2xl font-semibold">{pullRequest.title}</h1>
    </div>
  )
}
