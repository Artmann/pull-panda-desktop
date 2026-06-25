// OTEL-style identifiers: a trace id is 32 hex characters, a span id is 16.
// Works in both the main process (Node global `crypto`) and the renderer
// (`window.crypto`); falls back to a non-cryptographic generator if neither is
// available, which is fine for local-only debugging telemetry.

function randomHex(length: number): string {
  const byteLength = length / 2
  const source =
    typeof globalThis.crypto?.getRandomValues === 'function'
      ? globalThis.crypto
      : null

  if (source) {
    const bytes = new Uint8Array(byteLength)

    source.getRandomValues(bytes)

    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join(
      ''
    )
  }

  let result = ''

  while (result.length < length) {
    result += Math.floor(Math.random() * 16).toString(16)
  }

  return result.slice(0, length)
}

export function createTraceId(): string {
  return randomHex(32)
}

export function createSpanId(): string {
  return randomHex(16)
}
