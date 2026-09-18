import type { CheckRollup } from '@/app/components/check-rollup'

import { createMockPullRequest } from '../__test-helpers__/pull-request-fixtures'
import { buildRows, type SidebarRow } from './sidebar-data'

const hoursAgo = (hours: number): string =>
  new Date(Date.now() - hours * 3_600_000).toISOString()

interface Seed {
  approvalCount: number
  authorLogin: string
  changesRequestedCount: number
  checks: CheckRollup
  hours: number
  isAssignee: boolean
  isAuthor: boolean
  isDraft: boolean
  isReviewer: boolean
  number: number
  repositoryName: string
  repositoryOwner: string
  title: string
  viewed: boolean
}

const blank = {
  approvalCount: 0,
  changesRequestedCount: 0,
  isAssignee: false,
  isAuthor: false,
  isDraft: false,
  isReviewer: false
}

const seeds: Seed[] = [
  {
    ...blank,
    authorLogin: 'Artmann',
    checks: 'failing',
    hours: 12,
    isAuthor: true,
    number: 47,
    repositoryName: 'pull-panda-desktop',
    repositoryOwner: 'Artmann',
    title: 'Right-align Copy resolution prompt button',
    viewed: false
  },
  {
    ...blank,
    authorLogin: 'Artmann',
    checks: 'passing',
    hours: 11,
    isAuthor: true,
    number: 45,
    repositoryName: 'pull-panda-desktop',
    repositoryOwner: 'Artmann',
    title: 'Smooth font rendering on Windows',
    viewed: false
  },
  {
    ...blank,
    authorLogin: 'DaiCapra',
    checks: 'running',
    hours: 72,
    isAssignee: true,
    isReviewer: true,
    number: 55,
    repositoryName: 'esix',
    repositoryOwner: 'Artmann',
    title: 'Better examples',
    viewed: false
  },
  {
    ...blank,
    authorLogin: 'Melvin0070',
    changesRequestedCount: 2,
    checks: 'passing',
    hours: 24 * 60,
    isReviewer: true,
    number: 290,
    repositoryName: 'vscode-deepnote',
    repositoryOwner: 'deepnote',
    title: 'feat: add integration tests to CI workflow',
    viewed: true
  },
  {
    ...blank,
    authorLogin: 'pmkin-chris',
    changesRequestedCount: 3,
    checks: 'failing',
    hours: 24 * 180,
    isReviewer: true,
    number: 109,
    repositoryName: 'pmkin-app-remix',
    repositoryOwner: 'Artmann',
    title: 'Create the content planner',
    viewed: true
  },
  {
    ...blank,
    approvalCount: 1,
    authorLogin: 'Artmann',
    checks: 'passing',
    hours: 14,
    isAuthor: true,
    number: 41,
    repositoryName: 'pull-panda-desktop',
    repositoryOwner: 'Artmann',
    title: 'Add a tab with review tasks',
    viewed: true
  },
  {
    ...blank,
    authorLogin: 'Artmann',
    checks: 'none',
    hours: 24 * 90,
    isAuthor: true,
    isDraft: true,
    number: 110,
    repositoryName: 'pmkin-app-remix',
    repositoryOwner: 'Artmann',
    title: 'Update README.md',
    viewed: true
  },
  {
    ...blank,
    approvalCount: 2,
    authorLogin: 'renovate',
    checks: 'passing',
    hours: 120,
    number: 12,
    repositoryName: 'esix',
    repositoryOwner: 'Artmann',
    title: 'Bump electron to 32.1',
    viewed: true
  }
]

const pullRequests = seeds.map((seed) =>
  createMockPullRequest({
    approvalCount: seed.approvalCount,
    authorAvatarUrl: null,
    authorLogin: seed.authorLogin,
    changesRequestedCount: seed.changesRequestedCount,
    id: `pr-${seed.number.toString()}`,
    isAssignee: seed.isAssignee,
    isAuthor: seed.isAuthor,
    isDraft: seed.isDraft,
    isReviewer: seed.isReviewer,
    lastViewedAt: seed.viewed ? new Date().toISOString() : null,
    number: seed.number,
    repositoryName: seed.repositoryName,
    repositoryOwner: seed.repositoryOwner,
    title: seed.title,
    updatedAt: hoursAgo(seed.hours)
  })
)

const checkRollups = new Map<string, CheckRollup>(
  seeds.map((seed) => [`pr-${seed.number.toString()}`, seed.checks])
)

export const storyRows: SidebarRow[] = buildRows(pullRequests, checkRollups)
