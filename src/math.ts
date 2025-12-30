export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

export function clamp01(value: number): number {
  return clamp(value, 0, 1)
}
