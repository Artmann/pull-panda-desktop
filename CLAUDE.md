# Pull Panda App

Electron desktop app for GitHub PR management built with React, TypeScript, and Vite.

Refer to @CODE_STYLE.md for how to write code in this project.

## Commands

- `yarn start` - Start development server
- `yarn make` - Build distributable packages
- `yarn lint` - Run ESLint
- `yarn format` - Format code with Prettier

## Architecture

### Electron Process Model

- **Main process** (`src/main.ts`) - Node.js environment, handles IPC, secure storage, GitHub API calls
- **Preload script** (`src/preload.ts`) - Bridge between main and renderer, exposes `window.auth` API
- **Renderer process** (`src/renderer.tsx`, `src/app/`) - React UI, no direct Node.js access

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

- `@/*` maps to `./src/*` (configured in tsconfig.json and vite.renderer.config.mts)

## Tech Stack

- **Framework:** Electron 39 + React 19
- **Build:** Vite + Electron Forge
- **Styling:** Tailwind CSS 4 + shadcn/ui
- **Auth:** GitHub OAuth Device Flow with encrypted token storage (safeStorage)

## Security

- Context isolation enabled
- Tokens stored encrypted via Electron's `safeStorage`
- Tokens never exposed to renderer process - all auth operations via IPC
