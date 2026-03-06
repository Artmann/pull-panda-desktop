export const queryKeys = {
  checks: {
    all: ['checks'] as const,
    byPullRequest: (id: string) => ['checks', id] as const
  },
  comments: {
    all: ['comments'] as const,
    byPullRequest: (id: string) => ['comments', id] as const
  },
  commits: {
    all: ['commits'] as const,
    byPullRequest: (id: string) => ['commits', id] as const
  },
  modifiedFiles: {
    all: ['modified-files'] as const,
    byPullRequest: (id: string) => ['modified-files', id] as const
  },
  pendingReviews: {
    all: ['pending-reviews'] as const,
    byPullRequest: (id: string) => ['pending-reviews', id] as const
  },
  pullRequests: {
    all: ['pull-requests'] as const
  },
  reactions: {
    all: ['reactions'] as const,
    byPullRequest: (id: string) => ['reactions', id] as const
  },
  reviews: {
    all: ['reviews'] as const,
    byPullRequest: (id: string) => ['reviews', id] as const
  }
}
