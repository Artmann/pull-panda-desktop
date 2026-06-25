import { Octokit } from '@octokit/rest'

import { imageMediaType } from '../../../lib/images'

export interface BlobImage {
  readonly bytes: Uint8Array
  readonly contentType: string
}

export interface GetBlobImageInput {
  readonly filePath: string
  readonly owner: string
  readonly repo: string
  readonly sha: string
  readonly token: string
}

// Fetches a single Git blob by its content-addressed SHA and returns the raw
// bytes alongside the media type inferred from the file path. Blobs are
// immutable, so callers can cache the response aggressively. Returns null when
// the file path is not a recognised image type.
export async function getBlobImage(
  input: GetBlobImageInput
): Promise<BlobImage | null> {
  const contentType = imageMediaType(input.filePath)

  if (!contentType) {
    return null
  }

  const octokit = new Octokit({ auth: input.token })

  const response = await octokit.rest.git.getBlob({
    file_sha: input.sha,
    owner: input.owner,
    repo: input.repo
  })

  const bytes =
    response.data.encoding === 'base64'
      ? Uint8Array.from(Buffer.from(response.data.content, 'base64'))
      : new TextEncoder().encode(response.data.content)

  return { bytes, contentType }
}
