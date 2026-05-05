import {
  ChevronDownIcon,
  FolderInputIcon,
  GitBranchIcon,
  Loader2Icon
} from 'lucide-react'
import { ReactElement, useState } from 'react'
import { useStore } from 'react-redux'
import { toast } from 'sonner'

import { Button } from '@/app/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/app/components/ui/dropdown-menu'
import { runPullRequestCheckout } from '@/app/lib/run-pr-checkout'
import type { AppStore } from '@/app/store'
import { connectedReposActions } from '@/app/store/connected-repos-slice'
import { useAppDispatch, useAppSelector } from '@/app/store/hooks'
import type { PullRequest } from '@/types/pull-request'
import type { CloneRepoResult, VerifyRepoResult } from '@/types/repo-checkout'

interface CheckoutBranchButtonProps {
  pullRequest: PullRequest
}

export function CheckoutBranchButton({
  pullRequest
}: CheckoutBranchButtonProps): ReactElement | null {
  const dispatch = useAppDispatch()
  const store = useStore() as AppStore
  const fullName = `${pullRequest.repositoryOwner}/${pullRequest.repositoryName}`

  const localPath = useAppSelector(
    (state) => state.connectedRepos.byFullName[fullName] ?? null
  )

  const isCheckoutInProgress = useAppSelector(
    (state) => state.connectedRepos.checkoutsInProgress[pullRequest.id] ?? false
  )

  const [isSettingUp, setIsSettingUp] = useState(false)

  const isWorking = isSettingUp || isCheckoutInProgress

  const headBranchMissing = pullRequest.headRefName === null

  const runCheckout = () => {
    void runPullRequestCheckout(store, pullRequest.id)
  }

  const handlePickExisting = () => {
    setIsSettingUp(true)

    window.electron.repoCheckout
      .pickFolder()
      .then(async ({ path }) => {
        if (!path) {
          return null
        }

        const verification: VerifyRepoResult =
          await window.electron.repoCheckout.verify({
            fullName,
            localPath: path
          })

        if (!verification.ok) {
          toast.error(
            verification.reason ?? `Folder is not a clone of ${fullName}.`
          )

          return null
        }

        await window.electron.repoCheckout.set({ fullName, localPath: path })
        dispatch(connectedReposActions.setRepo({ fullName, localPath: path }))

        return path
      })
      .then((path) => {
        setIsSettingUp(false)

        if (path) {
          runCheckout()
        }
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : 'Unknown error'

        toast.error(`Failed to connect repository: ${message}`)
        setIsSettingUp(false)
      })
  }

  const handleClone = () => {
    setIsSettingUp(true)

    window.electron.repoCheckout
      .pickFolder()
      .then(async ({ path: parentDir }) => {
        if (!parentDir) {
          return null
        }

        const result: CloneRepoResult =
          await window.electron.repoCheckout.clone({
            fullName,
            parentDir
          })

        if (!result.ok || !result.path) {
          toast.error(result.message ?? `Failed to clone ${fullName}.`)

          return null
        }

        await window.electron.repoCheckout.set({
          fullName,
          localPath: result.path
        })
        dispatch(
          connectedReposActions.setRepo({ fullName, localPath: result.path })
        )

        toast.success(`Cloned ${fullName} into ${result.path}.`)

        return result.path
      })
      .then((path) => {
        setIsSettingUp(false)

        if (path) {
          runCheckout()
        }
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : 'Unknown error'

        toast.error(`Failed to clone repository: ${message}`)
        setIsSettingUp(false)
      })
  }

  if (headBranchMissing) {
    return (
      <Button
        disabled
        size="xs"
        title="Branch is no longer available on GitHub."
        variant="outline"
      >
        <GitBranchIcon className="size-3" />
        Check out
      </Button>
    )
  }

  if (localPath) {
    return (
      <Button
        disabled={isWorking}
        onClick={runCheckout}
        size="xs"
        title={`Check out into ${localPath}`}
        variant="outline"
      >
        {isWorking ? (
          <Loader2Icon className="size-3 animate-spin" />
        ) : (
          <GitBranchIcon className="size-3" />
        )}
        {isWorking ? 'Checking out' : 'Check out'}
      </Button>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          disabled={isWorking}
          size="xs"
          title={`Connect a local clone of ${fullName} to check out this branch.`}
          variant="outline"
        >
          {isWorking ? (
            <Loader2Icon className="size-3 animate-spin" />
          ) : (
            <GitBranchIcon className="size-3" />
          )}
          {isWorking ? 'Working…' : 'Check out'}
          <ChevronDownIcon className="size-3" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        className="w-72"
      >
        <div className="px-2 pt-2 pb-1.5 text-xs text-muted-foreground">
          Connect a local clone of{' '}
          <span className="font-mono text-foreground">{fullName}</span> to check
          out this branch.
        </div>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          className="gap-2"
          onSelect={handlePickExisting}
        >
          <FolderInputIcon className="size-4 text-muted-foreground" />
          Use an existing local clone…
        </DropdownMenuItem>

        <DropdownMenuItem
          className="gap-2"
          onSelect={handleClone}
        >
          <GitBranchIcon className="size-4 text-muted-foreground" />
          Clone fresh from GitHub…
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
