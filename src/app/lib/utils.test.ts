import { describe, expect, it } from 'vitest'

import { cn } from './utils'

describe('cn', () => {
  it('merges conflicting utilities from the same group', () => {
    expect(cn('px-2', 'px-4')).toEqual('px-4')
  })

  it('keeps custom font sizes alongside a text colour', () => {
    // tailwind-merge groups `text-*` by name. Without the custom font-size
    // registration it treats these as colours and drops them.
    expect(cn('text-2xs', 'text-muted-foreground')).toEqual(
      'text-2xs text-muted-foreground'
    )

    expect(cn('text-2xs', 'text-primary')).toEqual('text-2xs text-primary')
  })

  it('still treats a custom font size and a built-in one as conflicting', () => {
    expect(cn('text-2xs', 'text-sm')).toEqual('text-sm')
  })

  it('still treats two text colours as conflicting', () => {
    expect(cn('text-primary', 'text-muted-foreground')).toEqual(
      'text-muted-foreground'
    )
  })
})
