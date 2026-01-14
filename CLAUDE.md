# Pull Panda App

Electron desktop app for GitHub PR management built with React, TypeScript, and
Vite.

- Refer to @CODE_STYLE.md for how to write code in this project.
- Before using `useEffect`, review
  https://react.dev/learn/you-might-not-need-an-effect.
- When creating or updating resources:
  1. Create or Update the resource in the Redux state.
  2. Make an API request to apply the change.
  3. If the API request is successful: 3.1 Update the Redux store with the data
     from the API response.
  4. If the API request fails: 4.1 Rollback the Redux changes. 4.2 Show a error
     toast with a descriptive, helpful error message.

## Commands

- `yarn start` - Start development server
- `yarn make` - Build distributable packages
- `yarn lint` - Run ESLint
- `yarn format` - Format code with Prettier
- `yarn drizzle-kit generate` - Generate new migration from schema changes
- `yarn drizzle-kit migrate` - Apply pending migrations

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
