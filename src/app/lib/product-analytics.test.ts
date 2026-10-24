import { describe, expect, it } from 'vitest'

import { screenForPath } from './product-analytics'

describe('screenForPath', () => {
  it('maps routes to fixed screen names', () => {
    expect(
      [
        '/',
        '/pull-requests/PR_kwDOabc123',
        '/settings',
        '/sign-in',
        '/onboarding',
        '/bg',
        '/telemetry',
        '/unknown'
      ].map(screenForPath)
    ).toEqual([
      'home',
      'pull_request',
      'settings',
      'sign_in',
      'onboarding',
      'background_syncer',
      'telemetry',
      null
    ])
  })
})
