import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getBlobImage } from './get-blob-image'

const octokitMocks = vi.hoisted(() => ({
  getBlob: vi.fn()
}))

vi.mock('@octokit/rest', () => ({
  Octokit: class {
    rest = {
      git: { getBlob: octokitMocks.getBlob }
    }
  }
}))

const makeInput = (filePath: string) => ({
  filePath,
  owner: 'octocat',
  repo: 'demo',
  sha: 'blob_sha',
  token: 'token_123'
})

describe('getBlobImage', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('returns null without calling GitHub for non-image paths', async () => {
    const result = await getBlobImage(makeInput('src/index.ts'))

    expect(result).toEqual(null)
    expect(octokitMocks.getBlob).not.toHaveBeenCalled()
  })

  it('decodes base64 blob content and infers the media type from the path', async () => {
    const original = Uint8Array.from([137, 80, 78, 71, 13, 10])

    octokitMocks.getBlob.mockResolvedValue({
      data: {
        content: Buffer.from(original).toString('base64'),
        encoding: 'base64'
      }
    })

    const result = await getBlobImage(makeInput('assets/logo.png'))

    expect(result).toEqual({
      bytes: original,
      contentType: 'image/png'
    })
    expect(octokitMocks.getBlob).toHaveBeenCalledWith({
      file_sha: 'blob_sha',
      owner: 'octocat',
      repo: 'demo'
    })
  })

  it('encodes utf-8 content when GitHub returns a non-base64 encoding', async () => {
    octokitMocks.getBlob.mockResolvedValue({
      data: {
        content: 'GIF89a',
        encoding: 'utf-8'
      }
    })

    const result = await getBlobImage(makeInput('assets/anim.gif'))

    expect(result).toEqual({
      bytes: new TextEncoder().encode('GIF89a'),
      contentType: 'image/gif'
    })
  })
})
