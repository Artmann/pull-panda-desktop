// Drizzle's SQL AST has circular references; collect string/number leaves so
// tests can pattern-match against ids without depending on the AST shape.
export function collectLiterals(
  value: unknown,
  seen: WeakSet<object>
): string[] {
  if (value === null || value === undefined) {
    return []
  }

  if (typeof value === 'string') {
    return [value]
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return [String(value)]
  }

  if (typeof value !== 'object') {
    return []
  }

  const objectValue = value as object

  if (seen.has(objectValue)) {
    return []
  }

  seen.add(objectValue)

  const literals: string[] = []

  if (Array.isArray(value)) {
    for (const entry of value) {
      literals.push(...collectLiterals(entry, seen))
    }

    return literals
  }

  for (const entry of Object.values(value as Record<string, unknown>)) {
    literals.push(...collectLiterals(entry, seen))
  }

  return literals
}
