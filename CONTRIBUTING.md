# Contributing to Pull Panda

Welcome! We're glad you're interested in contributing.

## Prerequisites

- Node.js (LTS recommended)
- Yarn package manager
- A GitHub account (for testing OAuth)

## Getting Started

1. Clone the repo
2. Install dependencies:
   ```bash
   yarn install
   ```
3. Start the development server:
   ```bash
   yarn start
   ```

This launches the Electron app with hot reload.

## Commands

| Command          | Description                  |
| ---------------- | ---------------------------- |
| `yarn start`     | Start development server     |
| `yarn test`      | Run tests in watch mode      |
| `yarn test:run`  | Run tests once               |
| `yarn lint`      | Check code with ESLint       |
| `yarn format`    | Format code with Prettier    |
| `yarn typecheck` | Run TypeScript type checking |
| `yarn make`      | Build distributable packages |

## Architecture

Pull Panda uses Electron's process model:

- **Main process** (`src/main.ts`) - Node.js environment, handles IPC, secure
  storage, GitHub API calls
- **Preload script** (`src/preload.ts`) - Bridge between main and renderer
- **Renderer process** (`src/app/`) - React UI

### Key Directories

```
src/
├── app/              # React app (renderer process)
│   ├── pages/        # Route pages
│   ├── pull-requests/# PR-related views and components
│   └── store/        # Redux state management
├── auth/             # GitHub OAuth handling
├── database/         # Drizzle ORM schema and setup
├── sync/             # GitHub data synchronization
└── main/             # Main process utilities
```

### Path Aliases

`@/*` maps to `./src/*` - use it for imports.

## Code Style

See [CODE_STYLE.md](CODE_STYLE.md) for the full guide. Quick highlights:

- No semicolons
- Single quotes
- Use full words for variables (`request` not `req`)
- No `any` types

## Testing

Test files live next to their implementation:

```
src/app/pull-requests/
├── ChecksView.tsx
├── ChecksView.test.tsx
```

Run tests with `yarn test` or `yarn test:run`.

## Pull Requests

1. Branch from `main`
2. Make your changes
3. Run `yarn lint` and `yarn test:run`
4. Open a PR with a clear description

## License

MIT - your contributions will be under the same license.
