import { Context, Effect, Layer } from 'effect'

import { getDatabase, isDatabaseInitialized } from '../../database'
import { DatabaseNotInitializedError, DatabaseQueryError } from '../errors'

type DrizzleDb = ReturnType<typeof getDatabase>

export class Database extends Context.Tag('sync/Database')<
  Database,
  {
    readonly use: <A>(
      operation: string,
      fn: (db: DrizzleDb) => A
    ) => Effect.Effect<A, DatabaseQueryError | DatabaseNotInitializedError>
  }
>() {}

export const DatabaseLive: Layer.Layer<Database> = Layer.succeed(Database, {
  use: <A>(operation: string, fn: (db: DrizzleDb) => A) =>
    Effect.suspend(
      (): Effect.Effect<
        A,
        DatabaseQueryError | DatabaseNotInitializedError
      > => {
        if (!isDatabaseInitialized()) {
          return Effect.fail(new DatabaseNotInitializedError({ operation }))
        }

        return Effect.try({
          try: () => fn(getDatabase()),
          catch: (cause) => new DatabaseQueryError({ operation, cause })
        })
      }
    )
})
