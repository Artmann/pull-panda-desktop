import fs from 'node:fs'
import path from 'node:path'

import initSqlJs, { type SqlJsStatic } from 'sql.js'

// Shared helpers for the local-database inspection CLIs (`inspect-pr`,
// `inspect-traces`).

export const bold = (text: string) => `\x1b[1m${text}\x1b[0m`
export const cyan = (text: string) => `\x1b[36m${text}\x1b[0m`
export const dim = (text: string) => `\x1b[2m${text}\x1b[0m`
export const green = (text: string) => `\x1b[32m${text}\x1b[0m`
export const red = (text: string) => `\x1b[31m${text}\x1b[0m`
export const yellow = (text: string) => `\x1b[33m${text}\x1b[0m`

// Loads the sql.js runtime from the WASM binary in node_modules. Run from the
// project root, where the CLIs already expect the database files.
export async function loadSqlJs(): Promise<SqlJsStatic> {
  const wasmPath = path.join(
    process.cwd(),
    'node_modules',
    'sql.js',
    'dist',
    'sql-wasm.wasm'
  )
  const wasmBuffer = fs.readFileSync(wasmPath)
  const wasmBinary = wasmBuffer.buffer.slice(
    wasmBuffer.byteOffset,
    wasmBuffer.byteOffset + wasmBuffer.byteLength
  ) as ArrayBuffer

  return initSqlJs({ wasmBinary })
}
