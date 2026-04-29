/**
 * @vitest-environment jsdom
 */
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { createReviewStateTask } from '../__test-helpers__/factories'

import { ReviewStateExpansion } from './ReviewStateExpansion'

describe('ReviewStateExpansion', () => {
  it('renders the task summary', () => {
    render(
      <ReviewStateExpansion
        task={createReviewStateTask({
          summary: 'Address the requested changes and re-request review.'
        })}
      />
    )

    expect(
      screen.getByText('Address the requested changes and re-request review.')
    ).toBeDefined()
  })
})
