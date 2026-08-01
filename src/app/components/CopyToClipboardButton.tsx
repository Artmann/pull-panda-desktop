import { CheckIcon, CopyIcon } from 'lucide-react'
import { memo, useCallback, useState, type ReactElement } from 'react'

import { Button } from './ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip'

import { cn } from '@/app/lib/utils'

interface CopyToClipboardButtonProps {
  label?: string
  size?: 'icon-sm' | 'icon-xs'
  value: string
}

export const CopyToClipboardButton = memo(function CopyToClipboardButton({
  label = 'Copy to clipboard',
  size = 'icon-sm',
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
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          aria-label={label}
          className="relative"
          size={size}
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
      </TooltipTrigger>

      <TooltipContent>{hasBeenClicked ? 'Copied!' : label}</TooltipContent>
    </Tooltip>
  )
})
