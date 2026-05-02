/**
 * @vitest-environment jsdom
 */
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import {
  createPullRequest,
  createRequirementTask
} from '../__test-helpers__/factories'

import { RequirementExpansion } from './RequirementExpansion'

vi.mock('@/app/pull-requests/components/BranchSyncActions', () => ({
  BranchSyncActions: () => (
    <div data-testid="branch-sync-actions-stub">branch sync</div>
  )
}))

describe('RequirementExpansion', () => {
  it('renders the requirement description', () => {
    render(
      <RequirementExpansion
        pullRequest={createPullRequest()}
        task={createRequirementTask({
          description: 'Two approving reviews are required.'
        })}
      />
    )

    expect(
      screen.getByText('Two approving reviews are required.')
    ).toBeDefined()
  })

  it('renders the BranchSyncActions component', () => {
    render(
      <RequirementExpansion
        pullRequest={createPullRequest()}
        task={createRequirementTask()}
      />
    )

    expect(screen.getByTestId('branch-sync-actions-stub')).toBeDefined()
  })
})
