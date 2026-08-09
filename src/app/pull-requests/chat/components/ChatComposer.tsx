import { ArrowUpIcon, SquareIcon } from 'lucide-react'
import type { ReactElement } from 'react'

import { Button } from '@/app/components/ui/button'
import { Textarea } from '@/app/components/ui/textarea'
import { useDraft } from '@/app/store/use-draft'

export function ChatComposer({
  draftKey,
  isStreaming,
  onSend,
  onStop,
  placeholder = 'Ask about this pull request…'
}: {
  draftKey: string
  isStreaming: boolean
  onSend: (message: string) => void
  onStop: () => void
  placeholder?: string
}): ReactElement {
  const { body, setBody, clearDraft } = useDraft(draftKey)

  const canSend = body.trim().length > 0 && !isStreaming

  const handleSend = () => {
    const trimmed = body.trim()

    if (trimmed.length === 0 || isStreaming) {
      return
    }

    clearDraft()
    onSend(trimmed)
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="flex w-full flex-col gap-1 rounded-2xl border border-border bg-background p-2 shadow-xs transition-[color,box-shadow] focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50">
      <Textarea
        className="max-h-40 min-h-12 resize-none border-0 bg-transparent p-1.5 shadow-none focus-visible:ring-0 dark:bg-transparent"
        placeholder={placeholder}
        value={body}
        onChange={(event) => setBody(event.target.value)}
        onKeyDown={handleKeyDown}
      />

      <div className="flex items-center justify-between gap-2">
        <span className="px-1.5 text-xs text-muted-foreground">
          Shift+Enter for a new line
        </span>

        {isStreaming ? (
          <Button
            aria-label="Stop the agent"
            className="rounded-full"
            size="icon-sm"
            variant="outline"
            onClick={onStop}
          >
            <SquareIcon className="size-3.5" />
          </Button>
        ) : (
          <Button
            aria-label="Send message"
            className="rounded-full"
            disabled={!canSend}
            size="icon-sm"
            onClick={handleSend}
          >
            <ArrowUpIcon />
          </Button>
        )}
      </div>
    </div>
  )
}
