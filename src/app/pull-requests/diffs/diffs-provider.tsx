// Vite bundles the worker when imported with the `?worker` suffix; the default
// export is a Worker constructor. eslint-plugin-import can't resolve the
// virtual module, so the (correct) type comes from `vite/client`.
// eslint-disable-next-line import/default
import DiffsWorker from '@pierre/diffs/worker/worker.js?worker'
import {
  WorkerPoolContextProvider,
  useWorkerPool,
  type WorkerPoolOptions
} from '@pierre/diffs/react'
import { useEffect, type ReactElement, type ReactNode } from 'react'

import { useAppTheme } from '@/app/lib/store/themeContext'

// `@pierre/diffs` renders and highlights diffs off the main thread in a pool of
// web workers. We supply the worker factory ourselves so Vite bundles the
// worker as its own chunk (the `?worker` suffix), which keeps it working in
// both the dev server and packaged Electron builds.
const poolOptions: WorkerPoolOptions = {
  poolSize: 3,
  workerFactory: () => new DiffsWorker()
}

interface DiffsWorkerPoolProviderProps {
  children: ReactNode
}

export function DiffsWorkerPoolProvider({
  children
}: DiffsWorkerPoolProviderProps): ReactElement {
  const { appTheme } = useAppTheme()

  return (
    <WorkerPoolContextProvider
      highlighterOptions={{
        theme: {
          dark: appTheme.darkShikiTheme,
          light: appTheme.lightShikiTheme
        }
      }}
      poolOptions={poolOptions}
    >
      <WorkerPoolThemeSync />

      {children}
    </WorkerPoolContextProvider>
  )
}

// The worker pool is a singleton, so the initial `highlighterOptions.theme`
// only applies the first time it is created. When the user switches themes we
// push the new Shiki theme names into the running workers.
function WorkerPoolThemeSync(): null {
  const workerPool = useWorkerPool()
  const { appTheme } = useAppTheme()
  const darkTheme = appTheme.darkShikiTheme
  const lightTheme = appTheme.lightShikiTheme

  useEffect(() => {
    if (!workerPool) {
      return
    }

    workerPool
      .setRenderOptions({ theme: { dark: darkTheme, light: lightTheme } })
      .catch(() => {
        // Theme sync is best-effort; diffs still render with the theme the
        // pool was created with.
      })
  }, [workerPool, darkTheme, lightTheme])

  return null
}
