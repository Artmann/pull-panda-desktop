import path from 'node:path'

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getApiMainWindow } from '../main-window-ref'
import { screenshotRoute } from './screenshot'

const fsMocks = vi.hoisted(() => ({
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
  writeFileSync: vi.fn()
}))

vi.mock('node:fs', () => ({ default: fsMocks }))
vi.mock('../main-window-ref', () => ({ getApiMainWindow: vi.fn() }))

const getApiMainWindowMock = vi.mocked(getApiMainWindow)
const pngBuffer = Buffer.from('png-bytes')
const screenshotsDirectory = path.resolve('screenshots')

const makeWindow = () =>
  ({
    webContents: {
      capturePage: vi.fn().mockResolvedValue({ toPNG: () => pngBuffer })
    }
  }) as unknown as NonNullable<ReturnType<typeof getApiMainWindow>>

const postScreenshot = (body?: string) =>
  screenshotRoute.request('/', {
    body,
    headers:
      body === undefined ? undefined : { 'Content-Type': 'application/json' },
    method: 'POST'
  })

beforeEach(() => {
  vi.clearAllMocks()
})

describe('POST /', () => {
  it('responds with 503 when the main window is not available', async () => {
    getApiMainWindowMock.mockReturnValue(null)

    const response = await postScreenshot()

    expect({ json: await response.json(), status: response.status }).toEqual({
      json: { error: 'Main window not available' },
      status: 503
    })
    expect(fsMocks.writeFileSync).not.toHaveBeenCalled()
  })

  it('captures the page and writes the screenshot under the requested filename', async () => {
    getApiMainWindowMock.mockReturnValue(makeWindow())
    fsMocks.existsSync.mockReturnValue(true)

    const response = await postScreenshot(
      JSON.stringify({ filename: 'custom.png' })
    )
    const expectedPath = path.join(screenshotsDirectory, 'custom.png')

    expect({ json: await response.json(), status: response.status }).toEqual({
      json: { filename: 'custom.png', path: expectedPath, success: true },
      status: 200
    })
    expect(fsMocks.writeFileSync).toHaveBeenCalledWith(expectedPath, pngBuffer)
    expect(fsMocks.mkdirSync).not.toHaveBeenCalled()
  })

  it('falls back to a timestamped filename when the body is not valid JSON', async () => {
    getApiMainWindowMock.mockReturnValue(makeWindow())
    fsMocks.existsSync.mockReturnValue(true)

    const response = await postScreenshot('not json')

    expect({ json: await response.json(), status: response.status }).toEqual({
      json: {
        filename: expect.stringMatching(/^screenshot-\d+\.png$/),
        path: expect.stringContaining(screenshotsDirectory),
        success: true
      },
      status: 200
    })
  })

  it('creates the screenshots directory when it does not exist', async () => {
    getApiMainWindowMock.mockReturnValue(makeWindow())
    fsMocks.existsSync.mockReturnValue(false)

    const response = await postScreenshot(JSON.stringify({}))

    expect(response.status).toEqual(200)
    expect(fsMocks.mkdirSync).toHaveBeenCalledWith(screenshotsDirectory, {
      recursive: true
    })
  })
})
