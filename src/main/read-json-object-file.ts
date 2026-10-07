import fs from 'node:fs'

// Reads a JSON file that should hold a plain object. Returns an empty object
// when the file is missing, unreadable, not valid JSON, or not an object.
export function readJsonObjectFile(filePath: string): Record<string, unknown> {
  if (!fs.existsSync(filePath)) {
    return {}
  }

  try {
    const raw = fs.readFileSync(filePath, 'utf-8')
    const parsed = JSON.parse(raw) as unknown

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {}
    }

    return parsed as Record<string, unknown>
  } catch {
    return {}
  }
}
