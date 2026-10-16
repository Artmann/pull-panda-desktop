export interface VercelDeployment {
  previewUrl: string | null
  project: string
  status: string
  updated: string | null
}

const vercelBotLogins = new Set(['vercel', 'vercel[bot]'])

export function isVercelBot(login: string | null | undefined): boolean {
  return login ? vercelBotLogins.has(login.toLowerCase()) : false
}

/**
 * Reads the deployment table out of a Vercel bot comment so the timeline can
 * show one line per project instead of the whole markdown table. Returns an
 * empty list when the comment has no table it recognises, and the caller
 * falls back to rendering the comment as written.
 */
export function parseVercelDeployments(
  body: string | null
): VercelDeployment[] {
  if (!body) {
    return []
  }

  const rows = body
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('|') && line.endsWith('|'))
    .map((line) =>
      line
        .slice(1, -1)
        .split('|')
        .map((cell) => cell.trim())
    )

  const headerIndex = rows.findIndex(
    (cells) =>
      cells[0]?.toLowerCase() === 'project' &&
      cells[1]?.toLowerCase().startsWith('deployment')
  )

  if (headerIndex === -1) {
    return []
  }

  return rows
    .slice(headerIndex + 1)
    .filter((cells) => !cells.every((cell) => /^:?-+:?$/.test(cell)))
    .map(parseRow)
    .filter((deployment) => deployment !== null)
}

function parseRow(cells: string[]): VercelDeployment | null {
  const [projectCell, statusCell, actionsCell, updatedCell] = cells
  const project = toPlainText(projectCell ?? '')
  const status = toStatus(statusCell ?? '')

  if (!project || !status) {
    return null
  }

  return {
    previewUrl: findPreviewUrl(actionsCell ?? ''),
    project,
    status,
    updated: toPlainText(updatedCell ?? '') || null
  }
}

const linkPattern = /\[([^\]]*)\]\(([^)\s]+)[^)]*\)/g

function findPreviewUrl(cell: string): string | null {
  for (const match of cell.matchAll(linkPattern)) {
    if (/preview/i.test(match[1])) {
      return match[2]
    }
  }

  return null
}

// "![Ready](…) [Ready](…)" and "🔄 Building ([Inspect](…))" both reduce to the
// word: the badge image, the parenthesised link and any leading emoji go.
function toStatus(cell: string): string {
  const withoutAsides = cell.replace(/\(\s*\[[^\]]*\]\([^)]*\)\s*\)/g, '')

  return toPlainText(withoutAsides).replace(/^[^\p{L}]+/u, '')
}

function toPlainText(markdown: string): string {
  return markdown
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(linkPattern, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/[*_`]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}
