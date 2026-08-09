import { BotMessageSquareIcon } from 'lucide-react'
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactElement,
  type RefObject
} from 'react'
import { Link } from 'react-router'

import { Button } from '@/app/components/ui/button'
import { runOptimisticMutation } from '@/app/lib/mutations/run-optimistic-mutation'
import {
  chatActions,
  draftSessionKey,
  type ChatStreamingState
} from '@/app/store/chat-slice'
import { useAppDispatch, useAppSelector } from '@/app/store/hooks'
import type { AppDispatch } from '@/app/store'
import type { ChatMessageRecord } from '@/types/chat'
import type { PullRequest } from '@/types/pull-request'

import { ChatComposer } from './components/ChatComposer'
import { ChatMessageList } from './components/ChatMessageList'

interface ChatTabProps {
  pullRequest: PullRequest
}

function fetchSessions(dispatch: AppDispatch, pullRequestId: string): void {
  window.chat
    .getSessions(pullRequestId)
    .then((loaded) => {
      dispatch(
        chatActions.sessionsLoaded({
          pullRequestId,
          sessions: loaded
        })
      )
    })
    .catch(() => {
      // Leave the list unloaded; the user can still start a new chat.
    })
}

// The tab content wrapper adds pb-12 (3rem) below the chat container.
const bottomGap = 48
const minimumChatHeight = 240

// Measures how much vertical space is left between the chat container's top
// and the bottom of the app's scroll viewport, so the composer stays visible
// at any window size instead of relying on a hard-coded viewport offset.
function useAvailableHeight(
  ref: RefObject<HTMLDivElement | null>
): number | null {
  const [height, setHeight] = useState<number | null>(null)

  useLayoutEffect(() => {
    const element = ref.current

    if (!element) {
      return
    }

    const scrollContainer = element.closest('.overflow-auto')

    if (!(scrollContainer instanceof HTMLElement)) {
      return
    }

    const update = () => {
      if (element.offsetParent === null) {
        // The tab is hidden (forceMount keeps it in the DOM); measuring a
        // display:none element yields garbage. The observer fires again when
        // the tab becomes visible.
        return
      }

      const containerTop = scrollContainer.getBoundingClientRect().top
      const elementTop = element.getBoundingClientRect().top
      const offsetInContent =
        elementTop - containerTop + scrollContainer.scrollTop
      const available =
        scrollContainer.clientHeight - offsetInContent - bottomGap

      setHeight(Math.max(minimumChatHeight, Math.floor(available)))
    }

    update()

    const observer = new ResizeObserver(update)

    observer.observe(element)
    observer.observe(scrollContainer)

    return () => {
      observer.disconnect()
    }
  }, [ref])

  return height
}

// null = detection still running; true/false once resolved.
function useHasAgent(): boolean | null {
  const [hasAgent, setHasAgent] = useState<boolean | null>(null)

  useEffect(function detectConfiguredAgent() {
    let cancelled = false

    window.agents
      .detect()
      .then((agents) => {
        if (!cancelled) {
          setHasAgent(agents.some((agent) => agent.path !== null))
        }
      })
      .catch(() => {
        // If detection fails, let the user try anyway; send surfaces errors.
        if (!cancelled) {
          setHasAgent(true)
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  return hasAgent
}

function useChatSessions(pullRequestId: string) {
  const dispatch = useAppDispatch()

  const sessions = useAppSelector(
    (state) => state.chat.sessionsByPullRequest[pullRequestId]
  )
  const explicitSessionId = useAppSelector(
    (state) => state.chat.activeSessionIdByPullRequest[pullRequestId]
  )

  // Default to the most recent session until the user picks one or starts a
  // new chat (explicit null).
  const activeSessionId =
    explicitSessionId === undefined
      ? (sessions?.[0]?.id ?? null)
      : explicitSessionId

  useEffect(
    function loadSessions() {
      if (sessions === undefined) {
        fetchSessions(dispatch, pullRequestId)
      }
    },
    [dispatch, pullRequestId, sessions]
  )

  return { activeSessionId, sessions }
}

function useChatMessages(
  pullRequestId: string,
  activeSessionId: string | null
) {
  const dispatch = useAppDispatch()

  const messagesKey = activeSessionId ?? draftSessionKey(pullRequestId)
  const messages = useAppSelector(
    (state) => state.chat.messagesBySession[messagesKey]
  )
  const streaming = useAppSelector((state) =>
    activeSessionId
      ? (state.chat.streamingBySession[activeSessionId] ?? null)
      : null
  )

  const messagesLoaded = messages !== undefined

  useEffect(
    function loadMessages() {
      if (!activeSessionId || messagesLoaded) {
        return
      }

      window.chat
        .getMessages(activeSessionId)
        .then((loaded) => {
          dispatch(
            chatActions.messagesLoaded({
              messages: loaded,
              sessionId: activeSessionId
            })
          )
        })
        .catch(() => {
          // Best-effort; an empty conversation is still usable.
        })
    },
    [activeSessionId, dispatch, messagesLoaded]
  )

  return { messages: messages ?? [], streaming: streaming ?? null }
}

function AgentMissingNotice(): ReactElement {
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-center">
      <BotMessageSquareIcon className="size-8 text-muted-foreground" />

      <p className="text-sm text-muted-foreground">
        Chat needs a coding agent CLI like Claude Code or Codex. None was found
        on this machine.
      </p>

      <Button
        asChild
        size="sm"
        variant="outline"
      >
        <Link to="/settings">Configure an agent</Link>
      </Button>
    </div>
  )
}

function EmptyConversation(): ReactElement {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-muted">
        <BotMessageSquareIcon className="size-6 text-muted-foreground" />
      </div>

      <div className="flex max-w-sm flex-col gap-1">
        <p className="text-base font-medium">Ask about this pull request</p>
        <p className="text-sm text-muted-foreground">
          Your agent can explain the changes, review the code, and answer
          questions about this pull request.
        </p>
      </div>
    </div>
  )
}

function sendChatMessage(
  dispatch: AppDispatch,
  pullRequestId: string,
  sessionId: string | null,
  message: string
): void {
  const tempId = `temp-${crypto.randomUUID()}`

  runOptimisticMutation({
    commit: (result) => {
      dispatch(
        chatActions.runStarted({
          pullRequestId,
          result,
          tempId
        })
      )

      // Refresh the picker so a newly created session shows up.
      fetchSessions(dispatch, pullRequestId)
    },
    errorMessage: 'Failed to send the message to the agent.',
    optimistic: () => {
      dispatch(
        chatActions.userMessageSent({
          content: message,
          createdAt: new Date().toISOString(),
          pullRequestId,
          sessionId,
          tempId
        })
      )
    },
    request: () =>
      window.chat.send({
        message,
        pullRequestId,
        sessionId
      }),
    rollback: () => {
      dispatch(
        chatActions.sendRolledBack({
          pullRequestId,
          sessionId,
          tempId
        })
      )
    }
  })
}

function stopChatRun(sessionId: string | null): void {
  if (!sessionId) {
    return
  }

  window.chat.stop(sessionId).catch(() => {
    // The run may already be finished.
  })
}

function ChatConversation({
  messages,
  streaming
}: {
  messages: ChatMessageRecord[]
  streaming: ChatStreamingState | null
}): ReactElement {
  if (messages.length === 0 && !streaming) {
    return <EmptyConversation />
  }

  return (
    <ChatMessageList
      messages={messages}
      streaming={streaming}
    />
  )
}

export function ChatTab({ pullRequest }: ChatTabProps): ReactElement {
  const containerRef = useRef<HTMLDivElement>(null)
  const dispatch = useAppDispatch()

  const availableHeight = useAvailableHeight(containerRef)
  const hasAgent = useHasAgent()
  const { activeSessionId, sessions } = useChatSessions(pullRequest.id)
  const { messages, streaming } = useChatMessages(
    pullRequest.id,
    activeSessionId
  )

  if (hasAgent === false && (sessions?.length ?? 0) === 0) {
    return <AgentMissingNotice />
  }

  return (
    <div
      className="flex flex-col"
      ref={containerRef}
      style={{
        height: availableHeight === null ? undefined : `${availableHeight}px`
      }}
    >
      <div className="min-h-0 flex-1">
        <ChatConversation
          messages={messages}
          streaming={streaming}
        />
      </div>

      <ChatComposer
        draftKey={`chat:${activeSessionId ?? pullRequest.id}`}
        isStreaming={streaming !== null}
        onSend={(message) => {
          sendChatMessage(dispatch, pullRequest.id, activeSessionId, message)
        }}
        onStop={() => {
          stopChatRun(activeSessionId)
        }}
      />
    </div>
  )
}
