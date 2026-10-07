import { describe, expect, it } from 'vitest'

import type {
  ReviewerCandidate,
  ReviewerSection
} from './build-reviewer-candidates'
import { groupCandidatesBySection } from './use-reviewer-picker'

function createCandidate(
  login: string,
  section: ReviewerSection
): ReviewerCandidate {
  return {
    avatarUrl: `https://example.com/${login}.png`,
    description: null,
    displayName: login,
    isOwner: false,
    login,
    ownerPatterns: [],
    section
  }
}

describe('groupCandidatesBySection', () => {
  it('groups candidates by section and keeps their order', () => {
    const alice = createCandidate('alice', 'recent')
    const bob = createCandidate('bob', 'collaborator')
    const carol = createCandidate('carol', 'recent')

    const grouped = groupCandidatesBySection([alice, bob, carol])

    expect(grouped).toEqual(
      new Map([
        ['recent', [alice, carol]],
        ['collaborator', [bob]]
      ])
    )
  })

  it('returns an empty map when there are no candidates', () => {
    expect(groupCandidatesBySection([])).toEqual(new Map())
  })
})
