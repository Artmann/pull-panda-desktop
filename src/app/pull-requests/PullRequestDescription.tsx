import {
  CopyIcon,
  ExternalLinkIcon,
  FileTextIcon,
  LinkIcon,
  PencilIcon,
  TextQuoteIcon
} from 'lucide-react'
import { useRef, useState, type ReactElement, type ReactNode } from 'react'
import { toast } from 'sonner'

import { Kbd, shortcutLabel } from '@/app/components/Kbd'
import { MarkdownBlock } from '@/app/components/MarkdownBlock'
import { Button } from '@/app/components/ui/button'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger
} from '@/app/components/ui/context-menu'
import { Textarea } from '@/app/components/ui/textarea'
import { copyToClipboard } from '@/app/lib/clipboard'
import { draftsActions, getDraftKeyForComment } from '@/app/store/drafts-slice'
import { useAppDispatch, useAppSelector } from '@/app/store/hooks'
import type { PullRequest } from '@/types/pull-request'

import { useInlineEditField } from './use-inline-edit-field'

/**
 * The pull request description, read as markdown and edited in place. Editing
 * starts from the Edit button or the right-click menu and ends only through
 * Save or Cancel (or their shortcuts), so clicking elsewhere never commits a
 * half-written change.
 */
export function PullRequestDescription({
  pullRequest
}: {
  pullRequest: PullRequest
}): ReactElement {
  const {
    cancel: handleCancel,
    draft,
    isEditing,
    isMerged,
    save: handleSave,
    setDraft,
    startEdit: handleStartEdit
  } = useInlineEditField({
    pullRequest,
    initialDraft: pullRequest.body ?? '',
    errorMessage: 'Failed to update description',
    buildSave: (nextBody) => {
      if (nextBody === (pullRequest.body ?? '')) {
        return null
      }

      return {
        optimisticPullRequest: { ...pullRequest, body: nextBody },
        payload: { body: nextBody }
      }
    }
  })

  if (isEditing) {
    return (
      <DescriptionEditor
        draft={draft}
        onCancel={handleCancel}
        onChange={setDraft}
        onSave={handleSave}
      />
    )
  }

  const canEdit = !isMerged

  return (
    <DescriptionContextMenu
      canEdit={canEdit}
      onEdit={handleStartEdit}
      pullRequest={pullRequest}
    >
      {pullRequest.body ? (
        <div>
          {/*
            Floated so the first lines of the description wrap around it
            instead of running underneath.
          */}
          {canEdit && (
            <EditButton
              className="float-right mb-2 ml-4"
              label="Edit"
              onClick={handleStartEdit}
            />
          )}

          <MarkdownBlock
            className="pull-request-description *:first:mt-0!"
            content={pullRequest.body}
          />
        </div>
      ) : (
        <div className="flex items-center justify-between gap-4 text-sm text-muted-foreground italic">
          No description provided.
          {canEdit && (
            <EditButton
              label="Add description"
              onClick={handleStartEdit}
            />
          )}
        </div>
      )}
    </DescriptionContextMenu>
  )
}

function EditButton({
  className,
  label,
  onClick
}: {
  className?: string
  label: string
  onClick: () => void
}): ReactElement {
  return (
    <Button
      className={className}
      onClick={onClick}
      size="xs"
      variant="outline"
    >
      <PencilIcon className="size-3" />
      {label}
    </Button>
  )
}

function DescriptionEditor({
  draft,
  onCancel,
  onChange,
  onSave
}: {
  draft: string
  onCancel: () => void
  onChange: (value: string) => void
  onSave: () => void
}): ReactElement {
  return (
    <div className="flex flex-col gap-2">
      <Textarea
        aria-label="Description"
        autoFocus
        className="min-h-48 resize-y font-mono text-xs leading-relaxed"
        value={draft}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault()
            onCancel()
          } else if (
            event.key === 'Enter' &&
            (event.metaKey || event.ctrlKey)
          ) {
            event.preventDefault()
            onSave()
          }
        }}
      />

      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          Markdown is supported · <Kbd>{shortcutLabel('↵')}</Kbd> to save ·{' '}
          <Kbd>Esc</Kbd> to cancel
        </span>

        <div className="flex items-center gap-2">
          <Button
            onClick={onCancel}
            size="sm"
            variant="ghost"
          >
            Cancel
          </Button>

          <Button
            onClick={onSave}
            size="sm"
          >
            Save
          </Button>
        </div>
      </div>
    </div>
  )
}

function DescriptionContextMenu({
  canEdit,
  children,
  onEdit,
  pullRequest
}: {
  canEdit: boolean
  children: ReactNode
  onEdit: () => void
  pullRequest: PullRequest
}): ReactElement {
  const containerRef = useRef<HTMLDivElement>(null)
  const [selection, setSelection] = useState('')
  const quoteIntoComment = useQuoteIntoComment(pullRequest.id)

  // The menu offers to copy or quote what is selected, so read the selection
  // as the menu opens — choosing an item would otherwise clear it first.
  const captureSelection = () => {
    const current = window.getSelection()
    const isInside =
      current !== null &&
      current.rangeCount > 0 &&
      containerRef.current?.contains(current.anchorNode) === true

    setSelection(isInside ? current.toString().trim() : '')
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          onContextMenu={captureSelection}
          ref={containerRef}
        >
          {children}
        </div>
      </ContextMenuTrigger>

      <ContextMenuContent className="w-56">
        {selection && (
          <>
            <ContextMenuItem
              onSelect={() => copyToClipboard(selection, 'Selection copied.')}
            >
              <CopyIcon />
              Copy
            </ContextMenuItem>

            <ContextMenuItem onSelect={() => quoteIntoComment(selection)}>
              <TextQuoteIcon />
              Quote in comment
            </ContextMenuItem>

            <ContextMenuSeparator />
          </>
        )}

        {canEdit && (
          <ContextMenuItem onSelect={onEdit}>
            <PencilIcon />
            Edit description
          </ContextMenuItem>
        )}

        <ContextMenuItem
          disabled={!pullRequest.body}
          onSelect={() =>
            copyToClipboard(pullRequest.body ?? '', 'Description copied.')
          }
        >
          <FileTextIcon />
          Copy description as Markdown
        </ContextMenuItem>

        <ContextMenuSeparator />

        <ContextMenuItem
          onSelect={() => copyToClipboard(pullRequest.url, 'Link copied.')}
        >
          <LinkIcon />
          Copy GitHub link
        </ContextMenuItem>

        <ContextMenuItem
          onSelect={() => {
            window.electron.openUrl(pullRequest.url).catch((error: unknown) => {
              console.error('Failed to open pull request on GitHub:', error)
              toast.error('Could not open the pull request on GitHub.')
            })
          }}
        >
          <ExternalLinkIcon />
          Open in GitHub
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}

/**
 * Adds the text as a markdown quote to the end of the comment being written
 * at the bottom of the page, then takes the reader there to finish it.
 */
function useQuoteIntoComment(pullRequestId: string): (text: string) => void {
  const dispatch = useAppDispatch()
  const draftKey = getDraftKeyForComment(pullRequestId)
  const existing = useAppSelector((state) => state.drafts[draftKey] ?? '')

  return (text: string) => {
    const quote = text
      .split('\n')
      .map((line) => `> ${line}`)
      .join('\n')
    const body = existing.trim()
      ? `${existing.trimEnd()}\n\n${quote}\n\n`
      : `${quote}\n\n`

    dispatch(draftsActions.setDraft({ body, key: draftKey }))

    // Wait a frame so the textarea has the new text before it takes focus.
    requestAnimationFrame(() => {
      const commentBox = document.querySelector<HTMLTextAreaElement>(
        'textarea[aria-label="Comment"]'
      )

      commentBox?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      commentBox?.focus({ preventScroll: true })
      commentBox?.setSelectionRange(body.length, body.length)
    })
  }
}
