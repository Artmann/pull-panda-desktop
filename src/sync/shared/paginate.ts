import { Effect, Option, type Schema } from 'effect'

import { type GitHubTransportError } from '../errors'
import type { ETagKey } from '../schemas/domain'
import { GitHubRest } from '../services/github-rest'

const defaultPerPage = 100

interface PaginateOptions {
  etagKey?: ETagKey
  perPage?: number
}

// The ETag is only attached to the first request — subsequent pages must not 304.
function etagOptionsFor(
  page: number,
  options: PaginateOptions | undefined
): { etagKey: ETagKey } | undefined {
  if (page === 1 && options?.etagKey) {
    return { etagKey: options.etagKey }
  }

  return
}

// Pages through a REST endpoint whose response is `Schema.Array(Item)` directly.
// Returns Option.none() only when page 1 is None (304 / permission denied), so
// the caller's existing short-circuit behaviour is preserved. The ETag is only
// attached to the first request — subsequent pages must not 304.
export const paginateRest = <Item, I>(
  route: string,
  params: Record<string, unknown>,
  itemsSchema: Schema.Schema<ReadonlyArray<Item>, I>,
  options?: PaginateOptions
): Effect.Effect<
  Option.Option<ReadonlyArray<Item>>,
  GitHubTransportError,
  GitHubRest
> => paginateRestField(route, params, itemsSchema, (items) => items, options)

// Same as paginateRest but for endpoints whose response wraps the list (e.g.
// `{ total_count, check_runs: [...] }`). The extractor pulls the array out of
// each decoded page so we can keep accumulating across pages.
export const paginateRestField = <Response, I, Item>(
  route: string,
  params: Record<string, unknown>,
  responseSchema: Schema.Schema<Response, I>,
  extractItems: (response: Response) => ReadonlyArray<Item>,
  options?: PaginateOptions
): Effect.Effect<
  Option.Option<ReadonlyArray<Item>>,
  GitHubTransportError,
  GitHubRest
> =>
  Effect.gen(function* () {
    const rest = yield* GitHubRest
    const perPage = options?.perPage ?? defaultPerPage
    const collected: Item[] = []

    for (let page = 1; ; page++) {
      const requestOptions = etagOptionsFor(page, options)

      const result = yield* rest.request(
        route,
        { ...params, per_page: perPage, page },
        responseSchema,
        requestOptions
      )

      if (Option.isNone(result)) {
        if (page === 1) {
          return Option.none<ReadonlyArray<Item>>()
        }

        break
      }

      const items = extractItems(result.value)
      collected.push(...items)

      if (items.length < perPage) {
        break
      }
    }

    return Option.some(collected)
  })
