// GitHub's per-file `patch` (stored as `diffHunk`) contains only the hunk
// bodies (`@@ ... @@` plus the `+`/`-`/space lines) with no `diff --git`,
// `---`, or `+++` header. `@pierre/diffs`' `PatchDiff` parses the file name and
// change type out of that header, and infers the syntax-highlighting language
// from the name. So we reconstruct a well-formed single-file git patch around
// the stored hunk body before handing it to the renderer.

export interface BuildPatchFile {
  diffHunk: string
  filePath: string
  previousFilename?: string | null
  status?: string | null
}

const nullPath = '/dev/null'

export function buildPatch(file: BuildPatchFile): string {
  const newPath = file.filePath
  const oldPath = file.previousFilename ?? file.filePath
  const status = file.status ?? 'modified'

  const headerLines = [`diff --git a/${oldPath} b/${newPath}`]

  if (status === 'added') {
    headerLines.push('new file mode 100644')
    headerLines.push(`--- ${nullPath}`)
    headerLines.push(`+++ b/${newPath}`)
  } else if (status === 'removed') {
    headerLines.push('deleted file mode 100644')
    headerLines.push(`--- a/${oldPath}`)
    headerLines.push(`+++ ${nullPath}`)
  } else {
    if (file.previousFilename && file.previousFilename !== newPath) {
      headerLines.push(`rename from ${oldPath}`)
      headerLines.push(`rename to ${newPath}`)
    }

    headerLines.push(`--- a/${oldPath}`)
    headerLines.push(`+++ b/${newPath}`)
  }

  const body = file.diffHunk.endsWith('\n')
    ? file.diffHunk
    : `${file.diffHunk}\n`

  return `${headerLines.join('\n')}\n${body}`
}
