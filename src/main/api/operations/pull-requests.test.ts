import { describe, expect, it } from 'vitest'

import {
  branchRulesToProtection,
  buildRequirements,
  storedPullRequestChanges
} from './pull-requests'

type MergeState = Parameters<typeof buildRequirements>[0]
type Protection = Parameters<typeof buildRequirements>[1]

const makeProtection = (
  overrides: Partial<NonNullable<Protection>> = {}
): NonNullable<Protection> => ({
  requireCodeOwnerReview: false,
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

      expect(requirements.map((requirement) => requirement.key)).not.toContain(
        'approving-reviews'
      )
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

    it('asks for a code owner when the branch requires one', () => {
      const requirements = buildRequirements(
        makeState({ reviewDecision: 'REVIEW_REQUIRED' }),
        makeProtection({
          requireCodeOwnerReview: true,
          requiredApprovingReviewCount: 1
        })
      )

      expect(requirements[2]).toEqual({
        description: 'Waiting for an approving review from a code owner.',
        key: 'approving-reviews',
        label: '1 approving review required, including a code owner',
        satisfied: false
      })
    })

    it('requires a code owner review even without an approval count', () => {
      const requirements = buildRequirements(
        makeState({ reviewDecision: 'APPROVED' }),
        makeProtection({ requireCodeOwnerReview: true })
      )

      expect(requirements[2]).toEqual({
        description: 'All required reviews have been provided.',
        key: 'approving-reviews',
        label: 'Code owner review required',
        satisfied: true
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

      expect(requirements.map((requirement) => requirement.key)).not.toContain(
        'required-checks'
      )
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

      expect(requirements.map((requirement) => requirement.key)).not.toContain(
        'conversations-resolved'
      )
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

      expect(requirements.map((requirement) => requirement.key)).not.toContain(
        'branch-up-to-date'
      )
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

describe('storedPullRequestChanges', () => {
  const baseInput = {
    owner: 'octocat',
    pullNumber: 42,
    pullRequestId: 'pr_1',
    repo: 'demo',
    token: 'token'
  }
  const now = '2026-01-01T00:00:00Z'

  it('only includes the fields the input sets', () => {
    expect(
      storedPullRequestChanges(
        { ...baseInput, title: 'New title' },
        'OPEN',
        now
      )
    ).toEqual({ title: 'New title', updatedAt: now })
  })

  it('maps the REST state to the stored state', () => {
    expect([
      storedPullRequestChanges({ ...baseInput, state: 'closed' }, 'OPEN', now),
      storedPullRequestChanges({ ...baseInput, state: 'open' }, 'CLOSED', now)
    ]).toEqual([
      { state: 'CLOSED', updatedAt: now },
      { state: 'OPEN', updatedAt: now }
    ])
  })

  it('includes the body and draft flag when set', () => {
    expect(
      storedPullRequestChanges(
        { ...baseInput, body: 'Body', isDraft: true },
        'OPEN',
        now
      )
    ).toEqual({ body: 'Body', isDraft: true, updatedAt: now })
  })
})

type BranchRule = Parameters<typeof branchRulesToProtection>[0][number]

type PullRequestRuleParameters = NonNullable<
  Extract<BranchRule, { type: 'pull_request' }>['parameters']
>

const makePullRequestRule = (
  overrides: Partial<PullRequestRuleParameters> = {}
): PullRequestRuleParameters => ({
  dismiss_stale_reviews_on_push: false,
  require_code_owner_review: false,
  require_last_push_approval: false,
  required_approving_review_count: 0,
  required_review_thread_resolution: false,
  ...overrides
})

describe('branchRulesToProtection', () => {
  it('returns null when no rule affects merging', () => {
    expect(
      branchRulesToProtection([
        { type: 'deletion' },
        { type: 'non_fast_forward' }
      ])
    ).toEqual(null)
  })

  it('reads review and status check rules from a ruleset', () => {
    const protection = branchRulesToProtection([
      { type: 'deletion' },
      {
        parameters: makePullRequestRule({
          require_code_owner_review: true,
          required_approving_review_count: 1
        }),
        type: 'pull_request'
      },
      {
        parameters: {
          required_status_checks: [{ context: 'Validate API Entry' }],
          strict_required_status_checks_policy: true
        },
        type: 'required_status_checks'
      }
    ])

    expect(protection).toEqual({
      requireCodeOwnerReview: true,
      requireConversationResolution: false,
      requiredApprovingReviewCount: 1,
      requiresStrictStatusChecks: true
    })
  })

  it('keeps the strictest setting across overlapping rulesets', () => {
    const protection = branchRulesToProtection([
      {
        parameters: makePullRequestRule({
          required_approving_review_count: 2,
          required_review_thread_resolution: true
        }),
        type: 'pull_request'
      },
      {
        parameters: makePullRequestRule({
          require_code_owner_review: true,
          required_approving_review_count: 1
        }),
        type: 'pull_request'
      }
    ])

    expect(protection).toEqual({
      requireCodeOwnerReview: true,
      requireConversationResolution: true,
      requiredApprovingReviewCount: 2,
      requiresStrictStatusChecks: false
    })
  })
})
