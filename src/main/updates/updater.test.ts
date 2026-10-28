import { describe, expect, it } from 'vitest'

import type { UpdateStatus } from '../../lib/updates'
import {
  createUpdater,
  isNewerVersion,
  newerReleaseVersion,
  parseVersion,
  updateMessages,
  type UpdateBackend,
  type UpdateHandlers
} from './updater'

const currentVersion = '1.2.0'

interface TestBackend {
  backend: UpdateBackend
  // The handlers the updater registered, so a test can fire an outcome.
  emit: UpdateHandlers
  state: {
    checks: number
    installs: number
    subscribed: boolean
  }
}

function makeTestBackend(options: { failCheck?: Error } = {}): TestBackend {
  const state = { checks: 0, installs: 0, subscribed: false }

  let registered: UpdateHandlers | null = null

  const backend: UpdateBackend = {
    check(): void {
      state.checks++

      if (options.failCheck) {
        throw options.failCheck
      }
    },

    install(): void {
      state.installs++
    },

    subscribe(handlers: UpdateHandlers): () => void {
      registered = handlers
      state.subscribed = true

      return () => {
        registered = null
        state.subscribed = false
      }
    }
  }

  // Fires through whatever the updater registered, so a test that forgets to
  // let it subscribe fails loudly instead of silently doing nothing.
  const emit: UpdateHandlers = {
    downloaded: (version) => registered?.downloaded(version),
    downloading: () => registered?.downloading(),
    failed: (error) => registered?.failed(error),
    found: (version, message) => registered?.found(version, message),
    notFound: () => registered?.notFound()
  }

  return { backend, emit, state }
}

function makeSubject(
  options: { failCheck?: Error; unsupported?: string } = {}
): {
  errors: string[]
  updater: ReturnType<typeof createUpdater>
} & TestBackend {
  const testBackend = makeTestBackend({ failCheck: options.failCheck })
  const errors: string[] = []

  const updater = createUpdater({
    backend: testBackend.backend,
    currentVersion,
    logError: (message) => errors.push(message),
    now: () => 1_000,
    unsupported: options.unsupported ?? null
  })

  return { ...testBackend, errors, updater }
}

const idleStatus: UpdateStatus = {
  currentVersion,
  lastCheckedAt: null,
  message: null,
  releaseNotesUrl: null,
  state: 'idle',
  version: null
}

// What a downloaded 1.3.0 projects to, and so what a claim on it hands back.
// Written out rather than compared against `status()`: an assertion between two
// calls of the same implementation is satisfied by whatever the two agree on,
// which is every answer it could give.
const readyStatus: UpdateStatus = {
  ...idleStatus,
  lastCheckedAt: 1_000,
  releaseNotesUrl:
    'https://github.com/Artmann/pull-panda-desktop/releases/tag/v1.3.0',
  state: 'ready',
  version: '1.3.0'
}

describe('parseVersion', () => {
  it('reads the version release-please produces', () => {
    expect(parseVersion('v1.3.0')).toEqual('1.3.0')
  })

  it('reads the version out of a component-prefixed release name', () => {
    expect(parseVersion('pull-panda: v1.2.0')).toEqual('1.2.0')
  })

  it('keeps a prerelease suffix', () => {
    expect(parseVersion('v2.0.0-beta.1')).toEqual('2.0.0-beta.1')
  })

  it('returns null for a name with no version in it', () => {
    expect(parseVersion('Latest build')).toEqual(null)
  })

  it('returns null when Windows gave us nothing', () => {
    expect(parseVersion(null)).toEqual(null)
  })
})

describe('isNewerVersion', () => {
  it('accepts a higher patch, minor, and major', () => {
    expect([
      isNewerVersion('1.2.0', '1.2.1'),
      isNewerVersion('1.2.0', '1.3.0'),
      isNewerVersion('1.2.0', '2.0.0')
    ]).toEqual([true, true, true])
  })

  it('rejects the same version and anything older', () => {
    expect([
      isNewerVersion('1.2.0', '1.2.0'),
      isNewerVersion('1.2.0', '1.1.9'),
      isNewerVersion('1.2.0', '0.9.0')
    ]).toEqual([false, false, false])
  })

  it('tolerates a v prefix on either side', () => {
    expect([
      isNewerVersion('1.2.0', 'v1.3.0'),
      isNewerVersion('v1.2.0', '1.3.0')
    ]).toEqual([true, true])
  })

  it('does not treat a prerelease of the version we run as an upgrade', () => {
    expect(isNewerVersion('1.2.0', '1.2.0-beta.1')).toEqual(false)
  })

  it('compares numerically rather than lexically', () => {
    expect(isNewerVersion('1.9.0', '1.10.0')).toEqual(true)
  })

  it('refuses to offer an update for an unreadable version', () => {
    expect([
      isNewerVersion('1.2.0', 'nightly'),
      isNewerVersion('1.2.0', '1.2'),
      isNewerVersion('not-a-version', '1.3.0')
    ]).toEqual([false, false, false])
  })
})

describe('newerReleaseVersion', () => {
  it('returns the version of a newer release', () => {
    expect(newerReleaseVersion({ tag_name: 'v1.3.0' }, currentVersion)).toEqual(
      '1.3.0'
    )
  })

  it('returns null for the release already running or an older one', () => {
    expect([
      newerReleaseVersion({ tag_name: 'v1.2.0' }, currentVersion),
      newerReleaseVersion({ tag_name: 'v1.1.0' }, currentVersion)
    ]).toEqual([null, null])
  })

  it('returns null for a tag with no version in it', () => {
    expect(
      newerReleaseVersion({ tag_name: 'nightly' }, currentVersion)
    ).toEqual(null)
  })

  it('throws when the response has no tag name', () => {
    expect(() =>
      newerReleaseVersion({ name: 'v1.3.0' }, currentVersion)
    ).toThrow('The latest GitHub release has no tag name.')
  })
})

describe('createUpdater', () => {
  it('starts idle and subscribes to the backend', () => {
    const subject = makeSubject()

    expect(subject.updater.status()).toEqual(idleStatus)
    expect(subject.state.subscribed).toEqual(true)
  })

  it('reports checking while a check is in flight', () => {
    const subject = makeSubject()

    subject.updater.check()

    expect(subject.updater.status()).toEqual({
      ...idleStatus,
      state: 'checking'
    })
    expect(subject.state.checks).toEqual(1)
  })

  it('goes back to idle when there is no update', () => {
    const subject = makeSubject()

    subject.updater.check()
    subject.emit.notFound()

    expect(subject.updater.status()).toEqual({
      ...idleStatus,
      lastCheckedAt: 1_000
    })
  })

  it('reports downloading, then ready with the notes URL', () => {
    const subject = makeSubject()

    subject.updater.check()
    subject.emit.downloading()

    expect(subject.updater.status()).toEqual({
      ...idleStatus,
      state: 'downloading'
    })

    subject.emit.downloaded('1.3.0')

    expect(subject.updater.status()).toEqual({
      currentVersion,
      lastCheckedAt: 1_000,
      message: null,
      releaseNotesUrl:
        'https://github.com/Artmann/pull-panda-desktop/releases/tag/v1.3.0',
      state: 'ready',
      version: '1.3.0'
    })
  })

  it('falls back to the latest-release URL when the version is unreadable', () => {
    const subject = makeSubject()

    subject.updater.check()
    subject.emit.downloaded(null)

    expect(subject.updater.status()).toEqual({
      currentVersion,
      lastCheckedAt: 1_000,
      message: null,
      releaseNotesUrl:
        'https://github.com/Artmann/pull-panda-desktop/releases/latest',
      state: 'ready',
      version: null
    })
  })

  it('reports available with the backend message when it cannot self-install', () => {
    const subject = makeSubject()

    subject.updater.check()
    subject.emit.found('1.3.0', updateMessages.linux)

    expect(subject.updater.status()).toEqual({
      currentVersion,
      lastCheckedAt: 1_000,
      message: updateMessages.linux,
      releaseNotesUrl:
        'https://github.com/Artmann/pull-panda-desktop/releases/tag/v1.3.0',
      state: 'available',
      version: '1.3.0'
    })
  })

  it('blames the connection when the check itself fails', () => {
    const subject = makeSubject()

    subject.updater.check()
    subject.emit.failed(new Error('getaddrinfo ENOTFOUND'))

    expect(subject.updater.status()).toEqual({
      ...idleStatus,
      lastCheckedAt: 1_000,
      message: updateMessages.checkFailed,
      state: 'error'
    })
    expect(subject.errors).toEqual([
      'Pull Panda could not update itself: getaddrinfo ENOTFOUND'
    ])
  })

  it('blames the download when it fails after starting', () => {
    const subject = makeSubject()

    subject.updater.check()
    subject.emit.downloading()
    subject.emit.failed(new Error('connection reset'))

    expect(subject.updater.status()).toEqual({
      ...idleStatus,
      lastCheckedAt: 1_000,
      message: updateMessages.downloadFailed,
      state: 'error'
    })
  })

  it('turns a throwing check into an error state', () => {
    const subject = makeSubject({ failCheck: new Error('no code signature') })

    subject.updater.check()

    expect(subject.updater.status()).toEqual({
      ...idleStatus,
      lastCheckedAt: 1_000,
      message: updateMessages.checkFailed,
      state: 'error'
    })
    expect(subject.errors).toEqual([
      'Pull Panda could not update itself: no code signature'
    ])
  })

  // The status bar shows nothing while a check runs, which is the behaviour
  // this keeps: an update the last check found is knowledge, and a check in
  // flight is what the updater is doing. Whether the two should be shown
  // together is a question about the indicator, not about this value.
  it('leaves the available update behind while it checks again', () => {
    const subject = makeSubject()

    subject.updater.check()
    subject.emit.found('1.3.0', updateMessages.linux)
    subject.updater.check()

    expect(subject.updater.status()).toEqual({
      ...idleStatus,
      lastCheckedAt: 1_000,
      state: 'checking'
    })
  })

  // A release can be pulled between two checks, and the second check is the
  // one that still holds.
  it('clears an update a later check no longer finds', () => {
    const subject = makeSubject()

    subject.updater.check()
    subject.emit.found('1.3.0', updateMessages.linux)
    subject.updater.check()
    subject.emit.notFound()

    expect(subject.updater.status()).toEqual({
      ...idleStatus,
      lastCheckedAt: 1_000
    })
  })

  // The message named the check that failed. Carried into the next one it
  // describes an attempt that is still in flight, and the renderer shows it
  // verbatim.
  it('leaves the failure behind when it checks again', () => {
    const subject = makeSubject()

    subject.updater.check()
    subject.emit.failed(new Error('offline'))
    subject.updater.check()

    expect(subject.updater.status()).toEqual({
      ...idleStatus,
      lastCheckedAt: 1_000,
      state: 'checking'
    })
  })

  it('leaves the failure behind when the download starts', () => {
    const subject = makeSubject()

    subject.updater.check()
    subject.emit.failed(new Error('offline'))
    subject.updater.check()
    subject.emit.downloading()

    expect(subject.updater.status()).toEqual({
      ...idleStatus,
      lastCheckedAt: 1_000,
      state: 'downloading'
    })
  })

  // The sequence packaged Linux sits in: an update it cannot install, then a
  // later check that fails. What the failed check knows is that it failed —
  // the version and the notes URL belong to a check that is no longer the
  // latest word, and an error offering a release to download is a claim this
  // one cannot make.
  it('leaves the available update behind when a later check fails', () => {
    const subject = makeSubject()

    subject.updater.check()
    subject.emit.found('1.3.0', updateMessages.linux)
    subject.updater.check()
    subject.emit.failed(new Error('the feed went away'))

    expect(subject.updater.status()).toEqual({
      ...idleStatus,
      lastCheckedAt: 1_000,
      message: updateMessages.checkFailed,
      state: 'error'
    })
  })

  it('retries after a failure', () => {
    const subject = makeSubject()

    subject.updater.check()
    subject.emit.failed(new Error('offline'))
    subject.updater.check()

    expect(subject.state.checks).toEqual(2)
  })

  // Squirrel downloads the update once per checkForUpdates() call, so a second
  // check while it is busy costs the user a duplicate download.
  it('does not check again while checking, downloading, or ready', () => {
    const checking = makeSubject()

    checking.updater.check()
    checking.updater.check()

    expect(checking.state.checks).toEqual(1)

    const downloading = makeSubject()

    downloading.updater.check()
    downloading.emit.downloading()
    downloading.updater.check()

    expect(downloading.state.checks).toEqual(1)

    const ready = makeSubject()

    ready.updater.check()
    ready.emit.downloaded('1.3.0')
    ready.updater.check()

    expect(ready.state.checks).toEqual(1)
  })

  it('refuses a claim until an update is ready', () => {
    const subject = makeSubject()

    expect(subject.updater.beginInstall()).toEqual(null)

    subject.updater.check()
    subject.emit.downloaded('1.3.0')

    expect(subject.updater.beginInstall()).toEqual(readyStatus)
  })

  it('hands nothing to the backend until the claim is completed', () => {
    const subject = makeSubject()

    subject.updater.check()
    subject.emit.downloaded('1.3.0')
    subject.updater.beginInstall()

    // The hand-off is deliberately later than the claim: the HTTP response has
    // to reach the renderer before the app starts quitting under it.
    expect(subject.state.installs).toEqual(0)

    subject.updater.completeInstall()

    expect(subject.state.installs).toEqual(1)
  })

  // The gap between the claim and the hand-off is the window a retry or a
  // second client can ask in. A latch taken at hand-off time refuses the
  // duplicate hand-off but closes too late to say so, and the second request is
  // answered with a success for an install that was dropped.
  it('refuses a second claim before the first has been handed over', () => {
    const subject = makeSubject()

    subject.updater.check()
    subject.emit.downloaded('1.3.0')

    const claims = [
      subject.updater.beginInstall(),
      subject.updater.beginInstall(),
      subject.updater.beginInstall()
    ]

    subject.updater.completeInstall()

    expect({ claims, installs: subject.state.installs }).toEqual({
      claims: [readyStatus, null, null],
      installs: 1
    })
  })

  it('refuses a claim while an update is only available', () => {
    const subject = makeSubject()

    subject.updater.check()
    subject.emit.found('1.3.0', updateMessages.linux)

    // `available` is the state packaged Linux sits in: a newer version exists
    // and this platform cannot install it, so the GitHub backend's install()
    // throws by design. Nothing between the button and that defect but this
    // guard, and every other refusal here comes from the claim instead.
    expect({
      claim: subject.updater.beginInstall(),
      installs: subject.state.installs,
      state: subject.updater.status().state
    }).toEqual({ claim: null, installs: 0, state: 'available' })
  })

  // The claim answers for the whole status, not for the knowledge behind it.
  // Those came apart when the two were split: a download running over an
  // already-ready update leaves `knowledge` at `ready` while the updater is
  // plainly busy, and a guard reading only `knowledge` would hand out a claim
  // and answer it with a `downloading` status — a 200 saying "restart to
  // update" for an install that is being swapped under it. No backend emits
  // that pair today; this module exists because it holds state for an event
  // source it cannot ask, so the guard covers the state rather than the paths
  // known to reach it.
  it('refuses a claim while a download is running', () => {
    const subject = makeSubject()

    subject.updater.check()
    subject.emit.downloaded('1.3.0')
    subject.emit.downloading()

    expect({
      claim: subject.updater.beginInstall(),
      installs: subject.state.installs
    }).toEqual({ claim: null, installs: 0 })
  })

  it('does not let a later check reopen the claim', () => {
    const subject = makeSubject()

    subject.updater.check()
    subject.emit.downloaded('1.3.0')
    subject.updater.beginInstall()

    // A check cannot start while an update is ready, but the events behind one
    // can still arrive — a second downloaded must not license a second swap.
    subject.emit.downloaded('1.4.0')

    // The version comes along too. The claim is what is refused; the update on
    // disk is now 1.4.0, and reporting the one it replaced would offer a
    // restart into a version that is no longer there.
    expect({
      claim: subject.updater.beginInstall(),
      version: subject.updater.status().version
    }).toEqual({ claim: null, version: '1.4.0' })
  })

  it('does not let a later download reopen the claim', () => {
    const subject = makeSubject()

    subject.updater.check()
    subject.emit.downloaded('1.3.0')
    subject.updater.beginInstall()

    // A ready update blocks `check`, but a failure afterwards unblocks it, so
    // the scheduled check can run and land a second download while the first
    // install is still on its way to the backend. The claim is one-way: the app
    // is already being replaced, and Squirrel would swap the bundle twice.
    subject.emit.failed(new Error('the feed went away'))
    subject.updater.check()
    subject.emit.downloaded('1.4.0')

    expect({
      claim: subject.updater.beginInstall(),
      state: subject.updater.status().state
    }).toEqual({ claim: null, state: 'ready' })
  })

  it('tells listeners about every transition', () => {
    const subject = makeSubject()
    const states: string[] = []

    subject.updater.onChange((status) => states.push(status.state))
    subject.updater.check()
    subject.emit.downloading()
    subject.emit.downloaded('1.3.0')

    expect(states).toEqual(['checking', 'downloading', 'ready'])
  })

  it('stops telling a listener once it is removed', () => {
    const subject = makeSubject()
    const states: string[] = []

    const remove = subject.updater.onChange((status) =>
      states.push(status.state)
    )

    subject.updater.check()
    remove()
    subject.emit.notFound()

    expect(states).toEqual(['checking'])
  })

  it('removes its listeners when disposed', () => {
    const subject = makeSubject()

    subject.updater.dispose()

    expect(subject.state.subscribed).toEqual(false)
  })

  describe('when unsupported', () => {
    it('reports the reason and never subscribes', () => {
      const subject = makeSubject({
        unsupported: updateMessages.developmentBuild
      })

      expect(subject.updater.status()).toEqual({
        ...idleStatus,
        message: updateMessages.developmentBuild,
        state: 'unsupported'
      })
      expect(subject.state.subscribed).toEqual(false)
    })

    it('never checks or claims an install', () => {
      const subject = makeSubject({
        unsupported: updateMessages.notInApplicationsFolder
      })

      subject.updater.check()

      expect(subject.updater.beginInstall()).toEqual(null)
      expect(subject.state).toEqual({
        checks: 0,
        installs: 0,
        subscribed: false
      })
    })
  })
})
