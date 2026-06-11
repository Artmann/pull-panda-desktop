import { describe, expect, it } from 'vitest'

import { buildRequirements } from './pull-requests'

type MergeState = Parameters<typeof buildRequirements>[0]
type Protection = Parameters<typeof buildRequirements>[1]

const makeProtection = (
  overrides: Partial<NonNullable<Protection>> = {}
): NonNullable<Protection> => ({
  requireConversationResolution: false,
  requiredApprovingReviewCount: 0,
  requiresStrictStatusChecks: false,
  ...overrides
})

const makeState = (overrides: Partial<MergeState> = {}): MergeState => ({
  baseRefName: 'main',
  isDraft: false,
  mergeable: 'MERGEABLE',
  mergeStateStatus: 'CLEAN',
  requiredChecksPassing: true,
  reviewDecision: null,
  totalReviewThreads: 0,
  unresolvedReviewThreads: 0,
  ...overrides
})

describe('buildRequirements', () => {
  it('returns only the conflict and draft requirements without protection', () => {
    expect(buildRequirements(makeState(), null)).toEqual([
      {
        description: 'No merge conflicts.',
        key: 'no-conflicts',
        label: 'No merge conflicts',
        satisfied: true
      },
      {
        description: 'Pull request is ready for review.',
        key: 'not-draft',
        label: 'Not a draft',
        satisfied: true
      }
    ])
  })

  it('marks conflicts as unsatisfied when the branch is conflicting', () => {
    const requirements = buildRequirements(
      makeState({ mergeable: 'CONFLICTING' }),
      null
    )

    expect(requirements[0]).toEqual({
      description: 'This branch has conflicts that must be resolved.',
      key: 'no-conflicts',
      label: 'No merge conflicts',
      satisfied: false
    })
  })

  it('marks the draft requirement as unsatisfied for drafts', () => {
    const requirements = buildRequirements(makeState({ isDraft: true }), null)

    expect(requirements[1]).toEqual({
      description: 'This pull request is still a draft.',
      key: 'not-draft',
      label: 'Not a draft',
      satisfied: false
    })
  })

  describe('approving reviews', () => {
    it('omits the requirement when no approvals are required', () => {
      const requirements = buildRequirements(makeState(), makeProtection())

      expect(
        requirements.map((requirement) => requirement.key)
      ).not.toContain('approving-reviews')
    })

    it('uses the singular label for a single required review', () => {
      const requirements = buildRequirements(
        makeState({ reviewDecision: 'APPROVED' }),
        makeProtection({ requiredApprovingReviewCount: 1 })
      )

      expect(requirements[2]).toEqual({
        description: 'All required reviews have been provided.',
        key: 'approving-reviews',
        label: '1 approving review required',
        satisfied: true
      })
    })

    it('uses the plural label and reports requested changes', () => {
      const requirements = buildRequirements(
        makeState({ reviewDecision: 'CHANGES_REQUESTED' }),
        makeProtection({ requiredApprovingReviewCount: 2 })
      )

      expect(requirements[2]).toEqual({
        description: 'A reviewer has requested changes.',
        key: 'approving-reviews',
        label: '2 approving reviews required',
        satisfied: false
      })
    })

    it('reports waiting when there is no review decision yet', () => {
      const requirements = buildRequirements(
        makeState({ reviewDecision: null }),
        makeProtection({ requiredApprovingReviewCount: 1 })
      )

      expect(requirements[2]).toEqual({
        description: 'Waiting for required approving reviews.',
        key: 'approving-reviews',
        label: '1 approving review required',
        satisfied: false
      })
    })
  })

  describe('required checks', () => {
    it('omits the requirement when checks pass and strict checks are off', () => {
      const requirements = buildRequirements(makeState(), makeProtection())

      expect(
        requirements.map((requirement) => requirement.key)
      ).not.toContain('required-checks')
    })

    it('fails when the merge state is unstable', () => {
      const requirements = buildRequirements(
        makeState({ mergeStateStatus: 'UNSTABLE' }),
        null
      )

      expect(requirements[2]).toEqual({
        description: 'Some required status checks have not passed.',
        key: 'required-checks',
        label: 'Required checks passing',
        satisfied: false
      })
    })

    it('fails when required checks are not passing', () => {
      const requirements = buildRequirements(
        makeState({ requiredChecksPassing: false }),
        null
      )

      expect(requirements[2]).toEqual({
        description: 'Some required status checks have not passed.',
        key: 'required-checks',
        label: 'Required checks passing',
        satisfied: false
      })
    })

    it('passes when strict checks are required and everything is green', () => {
      const requirements = buildRequirements(
        makeState(),
        makeProtection({ requiresStrictStatusChecks: true })
      )

      expect(requirements[2]).toEqual({
        description: 'All required status checks have passed.',
        key: 'required-checks',
        label: 'Required checks passing',
        satisfied: true
      })
    })
  })

  describe('conversation resolution', () => {
    it('omits the requirement when resolution is not enforced', () => {
      const requirements = buildRequirements(
        makeState({ unresolvedReviewThreads: 3 }),
        makeProtection()
      )

      expect(
        requirements.map((requirement) => requirement.key)
      ).not.toContain('conversations-resolved')
    })

    it('passes when every conversation is resolved', () => {
      const requirements = buildRequirements(
        makeState(),
        makeProtection({ requireConversationResolution: true })
      )

      expect(requirements[2]).toEqual({
        description: 'All conversations have been resolved.',
        key: 'conversations-resolved',
        label: 'Conversations resolved',
        satisfied: true
      })
    })

    it('uses the singular noun for one unresolved conversation', () => {
      const requirements = buildRequirements(
        makeState({ unresolvedReviewThreads: 1 }),
        makeProtection({ requireConversationResolution: true })
      )

      expect(requirements[2]).toEqual({
        description: '1 unresolved conversation.',
        key: 'conversations-resolved',
        label: 'Conversations resolved',
        satisfied: false
      })
    })

    it('uses the plural noun for several unresolved conversations', () => {
      const requirements = buildRequirements(
        makeState({ unresolvedReviewThreads: 2 }),
        makeProtection({ requireConversationResolution: true })
      )

      expect(requirements[2]).toEqual({
        description: '2 unresolved conversations.',
        key: 'conversations-resolved',
        label: 'Conversations resolved',
        satisfied: false
      })
    })
  })

  describe('branch up to date', () => {
    it('omits the requirement when strict checks are off', () => {
      const requirements = buildRequirements(
        makeState({ mergeStateStatus: 'BEHIND' }),
        makeProtection()
      )

      expect(
        requirements.map((requirement) => requirement.key)
      ).not.toContain('branch-up-to-date')
    })

    it('fails when the branch is behind the base branch', () => {
      const requirements = buildRequirements(
        makeState({ mergeStateStatus: 'BEHIND' }),
        makeProtection({ requiresStrictStatusChecks: true })
      )

      expect(requirements.at(-1)).toEqual({
        description: 'This branch is behind the base branch.',
        key: 'branch-up-to-date',
        label: 'Branch is up to date',
        satisfied: false
      })
    })

    it('passes when the branch is up to date', () => {
      const requirements = buildRequirements(
        makeState(),
        makeProtection({ requiresStrictStatusChecks: true })
      )

      expect(requirements.at(-1)).toEqual({
        description: 'Branch is up to date with the base branch.',
        key: 'branch-up-to-date',
        label: 'Branch is up to date',
        satisfied: true
      })
    })
  })

  it('orders all requirements consistently under full protection', () => {
    const requirements = buildRequirements(
      makeState({
        isDraft: true,
        mergeable: 'CONFLICTING',
        mergeStateStatus: 'BEHIND',
        requiredChecksPassing: false,
        reviewDecision: null,
        unresolvedReviewThreads: 2
      }),
      makeProtection({
        requireConversationResolution: true,
        requiredApprovingReviewCount: 2,
        requiresStrictStatusChecks: true
      })
    )

    expect(requirements.map((requirement) => requirement.key)).toEqual([
      'no-conflicts',
      'not-draft',
      'approving-reviews',
      'required-checks',
      'conversations-resolved',
      'branch-up-to-date'
    ])

    expect(
      requirements.every((requirement) => requirement.satisfied === false)
    ).toEqual(true)
  })
})
