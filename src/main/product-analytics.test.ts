import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  isProductAnalyticsAllowed,
  parseRendererProductEvent,
  trackProductEvent
} from './product-analytics'
import { loadUsageSettings, setUsageReportingEnabled } from './usage-settings'

const { app, captureMock } = vi.hoisted(() => ({
  app: {
    getPath: vi.fn<() => string>(),
    getVersion: vi.fn<() => string>(),
    isPackaged: true
  },
  captureMock: vi.fn()
}))

vi.mock('electron', () => ({ app }))

vi.mock('posthog-node', () => ({
  PostHog: class {
    capture = captureMock
  }
}))

describe('product analytics', () => {
  let userDataPath: string

  beforeEach(() => {
    userDataPath = fs.mkdtempSync(path.join(os.tmpdir(), 'product-analytics-'))

    app.getPath.mockReturnValue(userDataPath)
    app.getVersion.mockReturnValue('1.6.0')
    app.isPackaged = true
    captureMock.mockReset()

    Object.defineProperty(process, 'getSystemVersion', {
      configurable: true,
      value: () => '15.5'
    })
  })

  afterEach(() => {
    fs.rmSync(userDataPath, { force: true, recursive: true })
    Reflect.deleteProperty(process, 'getSystemVersion')
    vi.unstubAllEnvs()
  })

  describe('isProductAnalyticsAllowed', () => {
    it('allows packaged builds with reporting enabled', () => {
      expect(isProductAnalyticsAllowed()).toEqual(true)
    })

    it('respects the usage reporting setting', () => {
      setUsageReportingEnabled(false)

      expect(isProductAnalyticsAllowed()).toEqual(false)
    })

    it('respects DO_NOT_TRACK', () => {
      vi.stubEnv('DO_NOT_TRACK', '1')

      expect(isProductAnalyticsAllowed()).toEqual(false)
    })

    it('skips dev builds unless opted in', () => {
      app.isPackaged = false

      expect(isProductAnalyticsAllowed()).toEqual(false)

      vi.stubEnv('PULL_PANDA_PRODUCT_ANALYTICS', '1')

      expect(isProductAnalyticsAllowed()).toEqual(true)
    })
  })

  describe('parseRendererProductEvent', () => {
    it('accepts a known event', () => {
      const event = {
        name: 'review_submitted',
        properties: { commentCount: '2-5', verdict: 'approve' }
      }

      expect(parseRendererProductEvent(event)).toEqual(event)
    })

    it('accepts an event without properties', () => {
      expect(parseRendererProductEvent({ name: 'signed_in' })).toEqual({
        name: 'signed_in'
      })
    })

    it('rejects unknown events', () => {
      expect(parseRendererProductEvent({ name: 'app_opened' })).toEqual(null)
      expect(parseRendererProductEvent({ name: 'anything' })).toEqual(null)
      expect(parseRendererProductEvent('signed_in')).toEqual(null)
    })

    it('rejects property values that look like free text', () => {
      expect(
        parseRendererProductEvent({
          name: 'command_run',
          properties: { command: 'Fix the login bug', source: 'palette' }
        })
      ).toEqual(null)

      expect(
        parseRendererProductEvent({
          name: 'command_run',
          properties: { command: { nested: true }, source: 'palette' }
        })
      ).toEqual(null)
    })
  })

  describe('trackProductEvent', () => {
    it('captures the event against the install id', () => {
      trackProductEvent({
        name: 'pull_request_merged',
        properties: { method: 'squash' }
      })

      expect(captureMock).toHaveBeenCalledWith({
        disableGeoip: true,
        distinctId: loadUsageSettings().installId,
        event: 'pull_request_merged',
        properties: {
          appVersion: '1.6.0',
          method: 'squash',
          osVersion: '15.5',
          platform: process.platform
        }
      })
    })

    it('sends nothing when reporting is disabled', () => {
      setUsageReportingEnabled(false)

      trackProductEvent({ name: 'signed_in' })

      expect(captureMock).not.toHaveBeenCalled()
    })
  })
})
