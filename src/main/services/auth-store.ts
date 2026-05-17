import { Context, Effect, Layer } from 'effect'
import { app, safeStorage } from 'electron'
import fs from 'node:fs'
import path from 'node:path'

import { FileSystemError } from '../api/errors'

function getEncryptedPath(): string {
  return path.join(app.getPath('userData'), 'github-token.enc')
}

function getPlainPath(): string {
  return path.join(app.getPath('userData'), 'github-token.txt')
}

export class AuthStore extends Context.Tag('main/AuthStore')<
  AuthStore,
  {
    readonly clear: Effect.Effect<void, FileSystemError>
    readonly load: Effect.Effect<string | null, FileSystemError>
    readonly save: (token: string) => Effect.Effect<void, FileSystemError>
  }
>() {}

export const AuthStoreLive: Layer.Layer<AuthStore> = Layer.succeed(AuthStore, {
  load: Effect.suspend((): Effect.Effect<string | null, FileSystemError> => {
    if (safeStorage.isEncryptionAvailable()) {
      const encryptedPath = getEncryptedPath()

      if (fs.existsSync(encryptedPath)) {
        return Effect.try({
          try: () => {
            const encrypted = fs.readFileSync(encryptedPath)

            return safeStorage.decryptString(encrypted)
          },
          catch: () => null as string | null
        }).pipe(Effect.catchAll(() => Effect.succeed<string | null>(null)))
      }
    }

    const plainPath = getPlainPath()

    if (fs.existsSync(plainPath)) {
      return Effect.try({
        try: () => fs.readFileSync(plainPath, 'utf-8').trim(),
        catch: () => null as string | null
      }).pipe(Effect.catchAll(() => Effect.succeed<string | null>(null)))
    }

    return Effect.succeed(null)
  }),

  save: (token: string) =>
    Effect.try({
      try: () => {
        if (safeStorage.isEncryptionAvailable()) {
          const encrypted = safeStorage.encryptString(token)

          fs.writeFileSync(getEncryptedPath(), encrypted)

          return
        }

        console.warn('safeStorage not available, storing token in plain text')
        fs.writeFileSync(getPlainPath(), token, 'utf-8')
      },
      catch: (cause) =>
        new FileSystemError({
          operation: 'save token',
          path: safeStorage.isEncryptionAvailable()
            ? getEncryptedPath()
            : getPlainPath(),
          cause
        })
    }),

  clear: Effect.try({
    try: () => {
      const encryptedPath = getEncryptedPath()
      const plainPath = getPlainPath()

      if (fs.existsSync(encryptedPath)) {
        fs.unlinkSync(encryptedPath)
      }

      if (fs.existsSync(plainPath)) {
        fs.unlinkSync(plainPath)
      }
    },
    catch: (cause) =>
      new FileSystemError({
        operation: 'clear token',
        path: getEncryptedPath(),
        cause
      })
  })
})
