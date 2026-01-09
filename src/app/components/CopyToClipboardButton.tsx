import { CheckIcon, CopyIcon } from 'lucide-react'
import { memo, useCallback, useState, type ReactElement } from 'react'

import { Button } from './ui/button'

import { cn } from '@/app/lib/utils'

interface CopyToClipboardButtonProps {
  value: string
}

export const CopyToClipboardButton = memo(function CopyToClipboardButton({
  value
}: CopyToClipboardButtonProps): ReactElement {
  const [hasBeenClicked, setHasBeenClicked] = useState(false)

  const handleCopy = useCallback((value: string) => {
    setHasBeenClicked(true)

    navigator.clipboard
      .writeText(value)
      .then(() => {
        setTimeout(() => {
          setHasBeenClicked(false)
        }, 3_000)
      })
      .catch((error: unknown) => {
        console.error('Failed to copy to clipboard:', error)
        setHasBeenClicked(false)
      })
  }, [])

  return (
    <Button
      aria-label="Copy to clipboard"
      className="relative"
      size="icon-sm"
      variant="ghost"
      onClick={() => {
        handleCopy(value)
      }}
    >
      <div className="size-3">
        <CopyIcon
          className={cn(
            'absolute size-3 transition-all ease-in-out',
            hasBeenClicked
              ? 'scale-0 opacity-0 blur-sm'
              : 'scale-100 opacity-100 blur-0'
          )}
        />
        <CheckIcon
          className={cn(
            'absolute size-3 transition-all ease-in-out',
            hasBeenClicked
              ? 'scale-100 opacity-100 blur-0'
              : 'scale-0 opacity-0 blur-sm'
          )}
        />
      </div>
    </Button>
  )
})
