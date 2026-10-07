import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { readJsonObjectFile } from './read-json-object-file'

describe('readJsonObjectFile', () => {
  let directory: string
  let filePath: string

  beforeEach(() => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'read-json-object-'))
    filePath = path.join(directory, 'store.json')
  })

  afterEach(() => {
    fs.rmSync(directory, { force: true, recursive: true })
  })

  it('returns the stored object', () => {
    fs.writeFileSync(filePath, JSON.stringify({ count: 2, name: 'panda' }))

    expect(readJsonObjectFile(filePath)).toEqual({ count: 2, name: 'panda' })
  })

  it('returns an empty object when the file is missing', () => {
    expect(readJsonObjectFile(filePath)).toEqual({})
  })

  it('returns an empty object for invalid JSON', () => {
    fs.writeFileSync(filePath, '{not json')

    expect(readJsonObjectFile(filePath)).toEqual({})
  })

  it('returns an empty object when the JSON is not an object', () => {
    fs.writeFileSync(filePath, JSON.stringify(['a', 'b']))

    expect(readJsonObjectFile(filePath)).toEqual({})

    fs.writeFileSync(filePath, 'null')

    expect(readJsonObjectFile(filePath)).toEqual({})

    fs.writeFileSync(filePath, '"text"')

    expect(readJsonObjectFile(filePath)).toEqual({})
  })
})
