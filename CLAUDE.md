# Pull Panda App

Electron desktop app for GitHub PR management built with React, TypeScript, and
Vite.

- Don't include Claude as the author or co-author in commit messages.
- Refer to @CODE_STYLE.md for how to write code in this project.
- Don't use the `sr-only` Tailwind class. It causes layout issues.
- Before using `useEffect`, review
  https://react.dev/learn/you-might-not-need-an-effect.
- After making code changes, always run `yarn lint`, `yarn tsc --noEmit`, and
  `yarn fallow` and fix every error before considering the task done.
- When working on a UI component, browse Storybook
  (`src/app/components/**/*.stories.tsx`) first to see how existing components
  look and are used. Prefer reusing or extending these patterns over inventing
  new ones.
- When adding a new UI component (under `src/app/components/` or
  `src/app/components/ui/`), add a `*.stories.tsx` file next to it covering the
  meaningful variants and states. Use title prefix `Components/<Name>` for
  custom components and `shadcn/<Name>` for shadcn primitives.
- When creating or updating resources:
  1. Update the Redux state optimistically (synchronously, before any API call).
  2. Fire the API request — do NOT use `async/await` in event handlers (e.g.
     `onClick`, `onSelect`). Use `.then().catch()` so the handler returns
     synchronously. This prevents UI frameworks (e.g. Radix UI) from delaying
     their own close/dismiss behaviour while waiting for a Promise to resolve.
  3. On success: update the Redux store with the data from the API response.
  4. On error: rollback the Redux changes and show an error toast with a
     descriptive, helpful error message.

## Pull request descriptions

When opening a PR, write the description in this order. Section names and
ordering are fixed; omit optional sections entirely when they don't apply (don't
write "None").

1. **Summary** (required) — 1–3 sentences in plain language. No jargon, no file
   paths, no acronyms a non-engineer wouldn't know. Tells the reader what the PR
   does and why it matters. Lead with the user-visible effect, not the
   implementation. Someone with zero prior context should finish this section
   knowing what changes for them.
2. **Technical details** (required) — Prose paragraph(s). What changed, which
   components/areas of the codebase are affected, and any notable implementation
   decisions. Reference files and symbols inline (`src/main/api/operations/`,
   `Repository.findPullRequestById`) rather than as a bullet list. A skim should
   reveal scope; a deep read should reveal intent.
3. **Test plan** (required) — A checkbox list of _manual_ steps a reviewer can
   run after checking out the branch. Phrase as imperative actions on the
   running app, e.g. "Open a PR you have permission to merge", "Click the
   three-dots menu and select 'Mark as ready for review'", "Confirm the PR row
   in the list updates within a few seconds". Do **not** list `yarn test:run`,
   `yarn typecheck`, or `yarn lint` — those are gates that already ran before
   the PR was opened, not review steps.
4. **Breaking changes** (only when relevant) — Anything that forces a reviewer
   to take an extra step to test, or that affects existing users on `main` after
   merge. Examples: "Sign out and sign back in to pick up the new token format",
   "Delete `pull-panda.db` before running", "Adds a `FOO` variable that needs to
   be set". Omit the section when there are none.
5. **Out of scope** (optional) — 1–3 bullets naming related things deliberately
   _not_ in this PR that a reviewer might otherwise ask about. Link to a
   follow-up issue or branch if one exists.

## Commands

- `yarn start` - Start development server
- `yarn storybook` - Launch Storybook on `localhost:6006` to browse UI
  components
- `yarn build-storybook` - Build a static Storybook bundle
- `yarn make` - Build distributable packages
- `yarn lint` - Run ESLint
- `yarn fallow` - Run fallow to check for dead code, circular deps, and
  complexity hotspots
- `yarn format` - Format code with Prettier
- `yarn drizzle-kit generate` - Generate new migration from schema changes
- `yarn drizzle-kit migrate` - Apply pending migrations
- `bun run inspect-pr <number>` - Dump all local DB data for a PR (reviews,
  comments, checks, commits, files). Use `--brief` for just the PR record,
  `--repo owner/name` to disambiguate across repos.
- `bun run inspect-traces` - Query the local OTEL-style telemetry (see
  Observability below). Lists recent traces; `--trace <id>` prints the span
  waterfall + correlated logs, `--slow` sorts by duration, `--errors` filters to
  error traces, `--op <name>` filters by operation, `--since 5m` bounds the
  window, `--stats` shows per-operation p50/p95, and `--json` emits
  machine-readable output for agents.

## Observability (local OTEL-style telemetry)

Dev builds capture OTEL-shaped spans and logs locally — nothing is sent to any
server. The Effect sync layer, GitHub REST/GraphQL calls, DB queries, IPC
handlers, the HTTP API, and renderer navigation/fetches are all instrumented,
and trace context propagates renderer → HTTP → Effect so one user action forms a
single trace.

- Spans/logs are stored in `pull-panda-telemetry.db` (separate from
  `pull-panda.db`), gated on `!app.isPackaged` so end users are never traced.
- Instrument new Effect code with `Effect.withSpan('name', { attributes })`;
  `Effect.logInfo/logError` are captured automatically. Non-Effect main code
  uses `withSpan`/`startSpan` from `src/telemetry/span.ts`; the renderer uses
  `startSpan` from `src/app/lib/telemetry/tracer.ts` and `tracedFetch`.
- View it in the app at `/telemetry` (command palette → "Open Telemetry
  Dashboard", or a link from `/bg`), or query it from the terminal with
  `bun run inspect-traces`.

## Driving the running app with agent-browser

- `yarn start` runs the app with Chromium's remote debugging port exposed on
  `9222` in development (gated on `!app.isPackaged`, so packaged production
  builds are unaffected).
- While it is running, use the `agent-browser` CLI (installed as a dev
  dependency) to inspect and control the UI over CDP, e.g.
  `yarn agent-browser --cdp 9222 snapshot -i` or
  `yarn agent-browser --cdp 9222 click @e2`.
- Prefer this over asking the user to verify UI behaviour manually.

## Architecture

### Electron Process Model

- **Main process** (`src/main.ts`) - Node.js environment, handles IPC, secure
  storage, GitHub API calls
- **Preload script** (`src/preload.ts`) - Bridge between main and renderer,
  exposes `window.auth` API
- **Renderer process** (`src/renderer.tsx`, `src/app/`) - React UI, no direct
  Node.js access

### Key Directories

```
src/
├── app/              # React app entry and pages
│   ├── App.tsx
│   └── pages/
├── components/       # React components
│   ├── ui/           # shadcn/ui components
│   └── auth/         # Auth-specific components
├── lib/
│   ├── ipc/          # IPC channel definitions
│   ├── store/        # React Context providers
│   └── utils.ts      # Tailwind cn() helper
└── types/            # TypeScript type definitions
```

### Path Aliases

- `@/*` maps to `./src/*` (configured in tsconfig.json and
  vite.renderer.config.mts)

## Tech Stack

- **Framework:** Electron 39 + React 19
- **Build:** Vite + Electron Forge
- **Styling:** Tailwind CSS 4 + shadcn/ui
- **Database:** SQLite via sql.js + Drizzle ORM
- **Auth:** GitHub OAuth Device Flow with encrypted token storage (safeStorage)

## Database

- Schema defined in `src/database/schema.ts`.
- Migrations stored in `drizzle/` and run automatically on app startup.
- After modifying the schema, run `yarn drizzle-kit generate` to create a new
  migration.
- To reset the database, delete `pull-panda.db` and restart the app.

## Security

- Context isolation enabled
- Tokens stored encrypted via Electron's `safeStorage`
- Tokens never exposed to renderer process - all auth operations via IPC
