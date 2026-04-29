const knownBotLogins = new Set([
  'claude',
  'codecov',
  'codecov-commenter',
  'coderabbit',
  'coderabbitai',
  'copilot',
  'dependabot',
  'github-actions',
  'panda',
  'pull-panda',
  'renovate',
  'sonarqubecloud',
  'vercel'
])

export function isBotAuthor(login: string | null | undefined): boolean {
  if (!login) {
    return false
  }

  const normalized = login.toLowerCase()

  if (normalized.endsWith('[bot]')) {
    return true
  }

  if (knownBotLogins.has(normalized)) {
    return true
  }

  return false
}
