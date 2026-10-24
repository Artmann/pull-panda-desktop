import { describe, expect, it } from 'vitest'

import { toCountBucket } from './product-analytics'

describe('toCountBucket', () => {
  it('groups counts into coarse ranges', () => {
    expect([0, 1, 2, 5, 6, 20, 21, 100, 101].map(toCountBucket)).toEqual([
      '0',
      '1',
      '2-5',
      '2-5',
      '6-20',
      '6-20',
      '21-100',
      '21-100',
      '100+'
    ])
  })
})
