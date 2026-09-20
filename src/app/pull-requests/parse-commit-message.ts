/**
 * Split a git commit message into its subject and body.
 *
 * Git's convention is a subject line, a blank line, then free-form prose. The
 * subject is the part written to be read on its own, so it is the only part
 * that belongs in a one-line summary; the body belongs in a tooltip or an
 * expanded view.
 */
export function parseCommitMessage(message: string | null): {
  body: string | null
  title: string
} {
  if (!message) {
    return { body: null, title: 'No message' }
  }

  const lines = message.split('\n')
  const title = lines[0] || 'No message'
  const bodyLines = lines.slice(1).filter((line) => line.trim() !== '')

  return { body: bodyLines.length > 0 ? bodyLines.join('\n') : null, title }
}
