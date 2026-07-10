import { Octokit } from '@octokit/rest'

export interface FileContentsResult {
  newContents: string
  oldContents: string
}

export interface GetFileContentsInput {
  readonly blobSha: string | null
  readonly owner: string
  readonly path: string
  readonly previousFilename: string | null
  readonly pullNumber: number
  readonly repo: string
  readonly status: string | null
  readonly token: string
}

interface GitHubContent {
  content?: string
  encoding?: string
  sha?: string
  type?: string
}

function decodeBase64(content: string): string {
  return Buffer.from(content, 'base64').toString('utf-8')
}

function isNotFound(cause: unknown): boolean {
  return (
    typeof cause === 'object' &&
    cause !== null &&
    'status' in cause &&
    (cause as { status: unknown }).status === 404
  )
}

async function readBlob(
  octokit: Octokit,
  owner: string,
  repo: string,
  fileSha: string
): Promise<string> {
  const response = await octokit.rest.git.getBlob({
    file_sha: fileSha,
    owner,
    repo
  })

  return response.data.encoding === 'base64'
    ? decodeBase64(response.data.content)
    : response.data.content
}

// Reads a file's full text at a specific commit. Large files (>1MB) come back
// from the Contents API without inline content, so we fall back to fetching the
// blob by its SHA. A missing file (e.g. it did not exist at the base commit)
// resolves to empty text rather than an error.
async function readContentAtRef(
  octokit: Octokit,
  owner: string,
  repo: string,
  path: string,
  ref: string
): Promise<string> {
  try {
    const response = await octokit.rest.repos.getContent({
      owner,
      path,
      ref,
      repo
    })
    const data = response.data as GitHubContent | GitHubContent[]

    if (Array.isArray(data) || data.type !== 'file') {
      return ''
    }

    if (data.encoding === 'base64' && data.content) {
      return decodeBase64(data.content)
    }

    if (data.sha) {
      return readBlob(octokit, owner, repo, data.sha)
    }

    return ''
  } catch (cause) {
    if (isNotFound(cause)) {
      return ''
    }

    throw cause
  }
}

// Fetches the complete old (base) and new (head) contents of a file in a pull
// request so the diff can be re-rendered with expandable unchanged context. The
// new version is read from the head blob SHA we already store; the old version
// is read from the base commit at the file's previous path (for renames).
export async function getFileContents(
  input: GetFileContentsInput
): Promise<FileContentsResult> {
  const octokit = new Octokit({ auth: input.token })

  const pullResponse = await octokit.rest.pulls.get({
    owner: input.owner,
    pull_number: input.pullNumber,
    repo: input.repo
  })
  const baseSha = pullResponse.data.base.sha
  const oldPath = input.previousFilename ?? input.path

  const [newContents, oldContents] = await Promise.all([
    input.status === 'removed' || !input.blobSha
      ? Promise.resolve('')
      : readBlob(octokit, input.owner, input.repo, input.blobSha),
    input.status === 'added'
      ? Promise.resolve('')
      : readContentAtRef(octokit, input.owner, input.repo, oldPath, baseSha)
  ])

  return { newContents, oldContents }
}
