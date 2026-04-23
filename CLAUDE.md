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
