import { describe, expect, it } from 'vitest'

import { imageMediaType, isImagePath } from './images'

describe('imageMediaType', () => {
  it('maps known raster extensions to their media type', () => {
    expect(imageMediaType('assets/logo.png')).toEqual('image/png')
    expect(imageMediaType('photo.JPG')).toEqual('image/jpeg')
    expect(imageMediaType('icon.ICO')).toEqual('image/x-icon')
  })

  it('returns null for text and vector files', () => {
    expect(imageMediaType('src/index.ts')).toEqual(null)
    expect(imageMediaType('logo.svg')).toEqual(null)
    expect(imageMediaType('Makefile')).toEqual(null)
  })
})

describe('isImagePath', () => {
  it('recognises raster image paths regardless of case', () => {
    expect(isImagePath('a/b/c.webp')).toEqual(true)
    expect(isImagePath('SCREENSHOT.PNG')).toEqual(true)
  })

  it('rejects non-image paths', () => {
    expect(isImagePath('readme.md')).toEqual(false)
    expect(isImagePath('noextension')).toEqual(false)
  })
})
