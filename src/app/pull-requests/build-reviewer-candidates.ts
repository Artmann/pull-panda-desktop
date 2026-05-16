import type { CodeownerEntry, Collaborator } from '@/app/lib/api'
import type { RecentReviewer } from '@/app/store/recent-reviewers-slice'

import { builtInReviewers, getBuiltInReviewer } from './built-in-reviewers'

export type ReviewerSection =
  | 'recent'
  | 'suggestion'
  | 'code-owner'
  | 'collaborator'

export interface ReviewerCandidate {
  avatarUrl: string
  description: string | null
  displayName: string
  isOwner: boolean
  login: string
  ownerPatterns: string[]
  section: ReviewerSection
}

interface BuildArgs {
  collaborators: Collaborator[]
  codeowners: CodeownerEntry[]
  excludeLogins?: Set<string>
  query: string
  recents: RecentReviewer[]
}

interface CandidateSource {
  avatarUrl: string
  description?: string | null
  displayName?: string
  login: string
}

export function buildReviewerCandidates({
  collaborators,
  codeowners,
  excludeLogins,
  query,
  recents
}: BuildArgs): ReviewerCandidate[] {
  const codeownerLogins = new Set(codeowners.map((entry) => entry.login))
  const codeownerPatternsByLogin = new Map(
    codeowners.map((entry) => [entry.login, entry.patterns])
  )
  const collaboratorsByLogin = new Map(
    collaborators.map((collaborator) => [collaborator.login, collaborator])
  )

  const normalizedQuery = query.trim().toLowerCase()

  const buildCandidate = (
    source: CandidateSource,
    section: ReviewerSection
  ): ReviewerCandidate => {
    const builtIn = getBuiltInReviewer(source.login)

    return {
      avatarUrl: builtIn?.avatarUrl ?? source.avatarUrl,
      description: source.description ?? builtIn?.description ?? null,
      displayName:
        source.displayName ?? builtIn?.displayName ?? source.login,
      isOwner: codeownerLogins.has(source.login),
      login: source.login,
      ownerPatterns: codeownerPatternsByLogin.get(source.login) ?? [],
      section
    }
  }

  const matchesQuery = (candidate: ReviewerCandidate): boolean => {
    if (!normalizedQuery) {
      return true
    }

    return (
      candidate.login.toLowerCase().includes(normalizedQuery) ||
      candidate.displayName.toLowerCase().includes(normalizedQuery)
    )
  }

  const seen = new Set<string>()
  const result: ReviewerCandidate[] = []

  const ingest = (
    sources: CandidateSource[],
    section: ReviewerSection
  ): void => {
    for (const source of sources) {
      if (seen.has(source.login)) {
        continue
      }

      if (excludeLogins?.has(source.login)) {
        seen.add(source.login)
        continue
      }

      seen.add(source.login)
      const candidate = buildCandidate(source, section)

      if (matchesQuery(candidate)) {
        result.push(candidate)
      }
    }
  }

  ingest(recents, 'recent')
  ingest(builtInReviewers, 'suggestion')

  const codeownerSources: CandidateSource[] = codeowners.map((entry) => ({
    avatarUrl:
      collaboratorsByLogin.get(entry.login)?.avatarUrl ??
      `https://github.com/${entry.login}.png`,
    login: entry.login
  }))

  ingest(codeownerSources, 'code-owner')
  ingest(collaborators, 'collaborator')

  return result
}
