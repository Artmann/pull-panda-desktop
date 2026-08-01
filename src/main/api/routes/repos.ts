import { Effect } from 'effect'
import { Hono, type Context as HonoContext } from 'hono'
import type { ContentfulStatusCode } from 'hono/utils/http-status'

import { effectHandler, requireString, type AppEnv } from '../effect-handler'
import { getBlobImage, type BlobImage } from '../operations/get-blob-image'
import { getFileContents } from '../operations/get-file-contents'
import { listCollaborators } from '../operations/list-collaborators'
import { listCodeowners } from '../operations/list-codeowners'

export const reposRoute = new Hono<AppEnv>()

interface BlobRequest {
  filePath: string
  owner: string
  repo: string
  sha: string
}

// Pulls the route params and `path` query needed to fetch a blob, returning
// null when any of them is missing so the caller can answer with a 400.
function readBlobRequest(context: HonoContext<AppEnv>): BlobRequest | null {
  const owner = context.req.param('owner')
  const repo = context.req.param('name')
  const sha = context.req.param('sha')
  const filePath = context.req.query('path')

  if (!owner || !repo || !sha || !filePath) {
    return null
  }

  return { filePath, owner, repo, sha }
}

interface FileContentsRequest {
  blobSha: string | null
  owner: string
  path: string
  previousFilename: string | null
  pullNumber: number
  repo: string
  status: string | null
}

// Pulls the route params and query needed to fetch file contents, returning
// null when any required part is missing so the caller can answer with a 400.
function readFileContentsRequest(
  context: HonoContext<AppEnv>
): FileContentsRequest | null {
  const owner = context.req.param('owner')
  const repo = context.req.param('name')
  const pullNumber = Number(context.req.param('pullNumber'))
  const path = context.req.query('path')

  if (!owner || !repo || !path || Number.isNaN(pullNumber)) {
    return null
  }

  return {
    blobSha: context.req.query('blobSha') ?? null,
    owner,
    path,
    previousFilename: context.req.query('previousFilename') ?? null,
    pullNumber,
    repo,
    status: context.req.query('status') ?? null
  }
}

function statusFromCause(cause: unknown): ContentfulStatusCode {
  if (
    typeof cause === 'object' &&
    cause !== null &&
    'status' in cause &&
    typeof (cause as { status: unknown }).status === 'number'
  ) {
    return (cause as { status: number }).status as ContentfulStatusCode
  }

  return 502
}

function toErrorResponse(
  context: HonoContext<AppEnv>,
  cause: unknown,
  fallbackMessage: string
) {
  const message = cause instanceof Error ? cause.message : fallbackMessage

  return context.json({ error: { message } }, statusFromCause(cause))
}

// Copies the blob into a standalone ArrayBuffer so the response body owns its
// bytes regardless of where the source view sits in its backing buffer.
function toResponseBody(image: BlobImage): ArrayBuffer {
  return image.bytes.buffer.slice(
    image.bytes.byteOffset,
    image.bytes.byteOffset + image.bytes.byteLength
  ) as ArrayBuffer
}

reposRoute.get('/:owner/:name/blobs/:sha', async (context) => {
  const request = readBlobRequest(context)

  if (!request) {
    return context.json(
      { error: { message: 'owner, name, sha and path are required' } },
      400
    )
  }

  try {
    const image = await getBlobImage({
      ...request,
      token: context.get('token')
    })

    if (!image) {
      return context.json(
        {
          error: { message: `Unsupported image type for ${request.filePath}` }
        },
        415
      )
    }

    return context.body(toResponseBody(image), 200, {
      'Cache-Control': 'private, max-age=31536000, immutable',
      'Content-Type': image.contentType
    })
  } catch (cause) {
    return toErrorResponse(context, cause, 'Failed to load image')
  }
})

reposRoute.get(
  '/:owner/:name/pulls/:pullNumber/file-contents',
  async (context) => {
    const request = readFileContentsRequest(context)

    if (!request) {
      return context.json(
        {
          error: { message: 'owner, name, pullNumber and path are required' }
        },
        400
      )
    }

    try {
      const contents = await getFileContents({
        ...request,
        token: context.get('token')
      })

      return context.json(contents, 200)
    } catch (cause) {
      return toErrorResponse(context, cause, 'Failed to load file contents')
    }
  }
)

reposRoute.get(
  '/:owner/:name/collaborators',
  effectHandler((context) =>
    Effect.gen(function* () {
      const owner = yield* requireString(context.req.param('owner'), 'owner')
      const repo = yield* requireString(context.req.param('name'), 'name')
      const token = context.get('token')

      return yield* listCollaborators({ owner, repo, token })
    })
  )
)

reposRoute.get(
  '/:owner/:name/codeowners',
  effectHandler((context) =>
    Effect.gen(function* () {
      const owner = yield* requireString(context.req.param('owner'), 'owner')
      const repo = yield* requireString(context.req.param('name'), 'name')
      const token = context.get('token')
      const pullRequestId = context.req.query('pullRequestId') ?? null

      return yield* listCodeowners({ owner, pullRequestId, repo, token })
    })
  )
)
