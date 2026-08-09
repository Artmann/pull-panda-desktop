import { execFile, spawn, type ChildProcess } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

import { eq } from 'drizzle-orm'
import { app, type BrowserWindow } from 'electron'

import { getDatabase } from '../../database'
import {
  pullRequests,
  type ChatSession,
  type PullRequest
} from '../../database/schema'
import { contentWithoutFailureMessage } from '../../lib/chat'
import { ipcChannels } from '../../lib/ipc/channels'
import type { ChatEvent, ChatSendResult, ChatStep } from '../../types/chat'
import { resolveAgentBinary } from '../agents/agent-detection'
import {
  loadAgentSettings,
  type AgentId,
  type AgentSettings
} from '../agents/agent-settings'
import { getApiPort } from '../api'
import { getMcpToken } from '../api/mcp-token'
import { getRepoPath } from '../connected-repos'
import { claudeAdapter } from './adapters/claude'
import { codexAdapter } from './adapters/codex'
import {
  createSession,
  getSession,
  insertMessage,
  touchSession,
  updateSessionAgentSessionId
} from './chat-store'
import { buildChatSystemPrompt } from './system-prompt'
import type { AgentAdapter, ParsedAgentEvent } from './types'

const adapters: Record<AgentId, AgentAdapter> = {
  claude: claudeAdapter,
  codex: codexAdapter
}

const idleTimeoutInMs = 5 * 60 * 1000

export interface ChatSendParams {
  message: string
  pullRequestId: string
  sessionId: string | null
}

interface ActiveRun {
  assistantMessageId: string
  child: ChildProcess
  idleTimer: NodeJS.Timeout | null
  resultIsError: boolean
  resultText: string | null
  sessionId: string
  stderr: string
  steps: ChatStep[]
  stopped: boolean
  textParts: string[]
  timedOut: boolean
}

function isWindowsScript(binaryPath: string): boolean {
  return /\.(bat|cmd)$/i.test(binaryPath)
}

class ChatManager {
  private mainWindow: BrowserWindow | null = null
  private runs: Map<string, ActiveRun> = new Map()

  dispose(): void {
    for (const run of this.runs.values()) {
      run.stopped = true
      this.kill(run)
    }

    this.runs.clear()
  }

  isRunning(sessionId: string): boolean {
    return this.runs.has(sessionId)
  }

  async send(params: ChatSendParams): Promise<ChatSendResult> {
    const database = getDatabase()
    const settings = loadAgentSettings()

    const { agent, session: activeSession } = await this.resolveSession(
      database,
      params,
      settings
    )

    if (this.runs.has(activeSession.id)) {
      throw new Error('The agent is still answering. Stop it first.')
    }

    const binaryPath = await resolveAgentBinary(agent, settings)

    if (!binaryPath) {
      throw new Error(
        `The ${adapters[agent].displayName} binary was not found. Configure it under Settings → Agents.`
      )
    }

    const userMessage = insertMessage(database, {
      content: params.message,
      pullRequestId: params.pullRequestId,
      role: 'user',
      sessionId: activeSession.id
    })

    touchSession(database, activeSession.id)

    const assistantMessageId = `streaming-${randomUUID()}`

    this.run({
      agent,
      assistantMessageId,
      binaryPath,
      message: params.message,
      pullRequestId: params.pullRequestId,
      resumeSessionId: activeSession.agentSessionId,
      sessionId: activeSession.id
    })

    return {
      assistantMessageId,
      sessionId: activeSession.id,
      userMessage
    }
  }

  setMainWindow(window: BrowserWindow | null): void {
    this.mainWindow = window
  }

  stop(sessionId: string): void {
    const run = this.runs.get(sessionId)

    if (!run) {
      return
    }

    run.stopped = true
    this.kill(run)
  }

  private broadcast(event: ChatEvent): void {
    const window = this.mainWindow

    if (!window || window.isDestroyed() || window.webContents.isDestroyed()) {
      return
    }

    window.webContents.send(ipcChannels.ChatEvent, event)
  }

  private fail(run: ActiveRun, message: string): void {
    const database = getDatabase()
    const content = contentWithoutFailureMessage(
      run.textParts.join('\n\n'),
      message
    )

    insertMessage(database, {
      content,
      errorMessage: message,
      eventsJson: run.steps.length > 0 ? JSON.stringify(run.steps) : null,
      pullRequestId: this.pullRequestIdOf(run.sessionId) ?? '',
      role: 'assistant',
      sessionId: run.sessionId
    })

    this.broadcast({
      kind: 'error',
      message,
      messageId: run.assistantMessageId,
      sessionId: run.sessionId
    })
  }

  private exitFailureMessage(run: ActiveRun, exitCode: number | null): string {
    const detail = run.resultText ?? run.stderr.trim().slice(-2000)

    return detail.length > 0
      ? detail
      : `The agent exited unexpectedly (code ${exitCode ?? 'unknown'}).`
  }

  private failureMessageFor(
    run: ActiveRun,
    exitCode: number | null
  ): string | null {
    if (run.stopped) {
      return 'Stopped.'
    }

    if (run.timedOut) {
      return 'The agent stopped responding and was shut down.'
    }

    if (exitCode !== 0) {
      return this.exitFailureMessage(run, exitCode)
    }

    if (run.resultIsError) {
      return this.exitFailureMessage(run, exitCode)
    }

    return null
  }

  private finish(run: ActiveRun, exitCode: number | null): void {
    this.runs.delete(run.sessionId)

    if (run.idleTimer) {
      clearTimeout(run.idleTimer)
    }

    const failureMessage = this.failureMessageFor(run, exitCode)

    if (failureMessage !== null) {
      this.fail(run, failureMessage)

      return
    }

    this.persistSuccess(run)
  }

  private kill(run: ActiveRun): void {
    const { child } = run

    if (child.exitCode !== null || child.pid === undefined) {
      return
    }

    if (process.platform === 'win32') {
      // The cmd.exe wrapper means the real agent is a child process, so kill
      // the whole tree.
      execFile('taskkill', ['/pid', String(child.pid), '/t', '/f'], () => {
        // Ignore failures; the process may already be gone.
      })
    } else {
      child.kill('SIGTERM')
    }
  }

  private async pickAgent(settings: AgentSettings): Promise<AgentId> {
    if (settings.defaultAgent) {
      return settings.defaultAgent
    }

    for (const id of ['claude', 'codex'] as const) {
      if (await resolveAgentBinary(id, settings)) {
        return id
      }
    }

    throw new Error(
      'No agent is configured. Set one up under Settings → Agents.'
    )
  }

  private persistSuccess(run: ActiveRun): void {
    const database = getDatabase()
    const content =
      run.textParts.length > 0
        ? run.textParts.join('\n\n')
        : (run.resultText ?? '')

    const message = insertMessage(database, {
      content,
      eventsJson: run.steps.length > 0 ? JSON.stringify(run.steps) : null,
      pullRequestId: this.pullRequestIdOf(run.sessionId) ?? '',
      role: 'assistant',
      sessionId: run.sessionId
    })

    touchSession(database, run.sessionId)

    this.broadcast({
      kind: 'done',
      message,
      sessionId: run.sessionId
    })
  }

  private pullRequestIdOf(sessionId: string): string | null {
    const session = getSession(getDatabase(), sessionId)

    return session?.pullRequestId ?? null
  }

  private async resolveSession(
    database: ReturnType<typeof getDatabase>,
    params: ChatSendParams,
    settings: AgentSettings
  ): Promise<{ agent: AgentId; session: ChatSession }> {
    const existing = params.sessionId
      ? getSession(database, params.sessionId)
      : null

    if (params.sessionId && !existing) {
      throw new Error('Chat session not found.')
    }

    if (existing) {
      return { agent: existing.agent as AgentId, session: existing }
    }

    const agent = await this.pickAgent(settings)
    const session = createSession(database, {
      agent,
      pullRequestId: params.pullRequestId,
      title: params.message
    })

    return { agent, session }
  }

  private resolveWorkingDirectory(pullRequest: PullRequest): {
    cwd: string
    hasRepoCheckout: boolean
  } {
    const connectedPath = getRepoPath(
      `${pullRequest.repositoryOwner}/${pullRequest.repositoryName}`
    )

    if (connectedPath && fs.existsSync(connectedPath)) {
      return { cwd: connectedPath, hasRepoCheckout: true }
    }

    const scratchPath = path.join(
      app.getPath('userData'),
      'chat-scratch',
      pullRequest.id
    )

    fs.mkdirSync(scratchPath, { recursive: true })

    return { cwd: scratchPath, hasRepoCheckout: false }
  }

  private loadRunContext(
    pullRequestId: string
  ): { apiPort: number; pullRequest: PullRequest } | { error: string } {
    const pullRequestRows = getDatabase()
      .select()
      .from(pullRequests)
      .where(eq(pullRequests.id, pullRequestId))
      .all()
    const pullRequest = pullRequestRows[0]

    if (!pullRequest) {
      return { error: 'Pull request not found.' }
    }

    const apiPort = getApiPort()

    if (apiPort === null) {
      return { error: 'The local API server is not running.' }
    }

    return { apiPort, pullRequest }
  }

  private spawnAgent(
    binaryPath: string,
    args: string[],
    cwd: string
  ): ChildProcess {
    // npm-installed CLIs resolve to .cmd shims on Windows, which Node refuses
    // to spawn directly (EINVAL) — route those through cmd.exe.
    if (isWindowsScript(binaryPath)) {
      return spawn('cmd.exe', ['/c', binaryPath, ...args], {
        cwd,
        windowsHide: true
      })
    }

    return spawn(binaryPath, args, { cwd, windowsHide: true })
  }

  private run(params: {
    agent: AgentId
    assistantMessageId: string
    binaryPath: string
    message: string
    pullRequestId: string
    resumeSessionId: string | null
    sessionId: string
  }): void {
    const adapter = adapters[params.agent]
    const context = this.loadRunContext(params.pullRequestId)

    if ('error' in context) {
      this.broadcast({
        kind: 'error',
        message: context.error,
        messageId: params.assistantMessageId,
        sessionId: params.sessionId
      })

      return
    }

    const { cwd, hasRepoCheckout } = this.resolveWorkingDirectory(
      context.pullRequest
    )

    const command = adapter.buildCommand({
      binaryPath: params.binaryPath,
      cwd,
      mcp: {
        token: getMcpToken(),
        url: `http://127.0.0.1:${context.apiPort}/api/mcp`
      },
      resumeSessionId: params.resumeSessionId,
      systemPrompt: params.resumeSessionId
        ? null
        : buildChatSystemPrompt(context.pullRequest, hasRepoCheckout),
      userMessage: params.message
    })

    const child = this.spawnAgent(params.binaryPath, command.args, cwd)

    const run: ActiveRun = {
      assistantMessageId: params.assistantMessageId,
      child,
      idleTimer: null,
      resultIsError: false,
      resultText: null,
      sessionId: params.sessionId,
      stderr: '',
      steps: [],
      stopped: false,
      textParts: [],
      timedOut: false
    }

    this.runs.set(params.sessionId, run)
    this.resetIdleTimer(run)

    child.stdin?.write(command.stdinPayload)
    child.stdin?.end()

    this.attachChildHandlers(run, adapter)
  }

  private attachChildHandlers(run: ActiveRun, adapter: AgentAdapter): void {
    const { child } = run

    let lineBuffer = ''

    child.stdout?.setEncoding('utf-8')
    child.stdout?.on('data', (chunk: string) => {
      this.resetIdleTimer(run)

      lineBuffer += chunk

      const lines = lineBuffer.split('\n')
      lineBuffer = lines.pop() ?? ''

      for (const line of lines) {
        this.handleLine(run, adapter, line.trim())
      }
    })

    child.stderr?.setEncoding('utf-8')
    child.stderr?.on('data', (chunk: string) => {
      run.stderr = (run.stderr + chunk).slice(-10_000)
    })

    child.on('error', (error: NodeJS.ErrnoException) => {
      this.runs.delete(run.sessionId)

      if (run.idleTimer) {
        clearTimeout(run.idleTimer)
      }

      const message =
        error.code === 'ENOENT'
          ? `The ${adapter.displayName} binary was not found. Configure it under Settings → Agents.`
          : `Failed to start ${adapter.displayName}: ${error.message}`

      this.fail(run, message)
    })

    child.on('close', (code) => {
      if (lineBuffer.trim().length > 0) {
        this.handleLine(run, adapter, lineBuffer.trim())
      }

      // `close` can fire after `error`; finish only if the run is still live.
      if (this.runs.has(run.sessionId)) {
        this.finish(run, code)
      }
    })
  }

  private applyParsedEvent(run: ActiveRun, event: ParsedAgentEvent): void {
    switch (event.kind) {
      case 'agent-session':
        updateSessionAgentSessionId(
          getDatabase(),
          run.sessionId,
          event.agentSessionId
        )
        break
      case 'assistant-text':
        run.textParts.push(event.text)
        this.broadcast({
          kind: 'assistant-delta',
          messageId: run.assistantMessageId,
          sessionId: run.sessionId,
          text: event.text
        })
        break
      case 'result':
        run.resultIsError = event.isError
        run.resultText = event.text
        break
      case 'tool-call':
        run.steps.push({ detail: event.detail, name: event.name })
        this.broadcast({
          detail: event.detail,
          kind: 'tool-call',
          messageId: run.assistantMessageId,
          name: event.name,
          sessionId: run.sessionId
        })
        break
    }
  }

  private handleLine(
    run: ActiveRun,
    adapter: AgentAdapter,
    line: string
  ): void {
    if (line.length === 0) {
      return
    }

    for (const event of adapter.parseLine(line)) {
      this.applyParsedEvent(run, event)
    }
  }

  private resetIdleTimer(run: ActiveRun): void {
    if (run.idleTimer) {
      clearTimeout(run.idleTimer)
    }

    run.idleTimer = setTimeout(() => {
      run.timedOut = true
      this.kill(run)
    }, idleTimeoutInMs)
  }
}

export const chatManager = new ChatManager()
