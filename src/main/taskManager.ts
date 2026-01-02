import { BrowserWindow } from 'electron'
import { randomUUID } from 'node:crypto'

import { ipcChannels } from '../lib/ipc/channels'
import type { Task, TaskProgress, TaskType } from '../types/task'

class TaskManager {
  private mainWindow: BrowserWindow | null = null
  private tasks: Map<string, Task> = new Map()

  setMainWindow(window: BrowserWindow | null): void {
    this.mainWindow = window
  }

  createTask(
    type: TaskType,
    options?: { message?: string; metadata?: Record<string, unknown> }
  ): Task {
    const task: Task = {
      id: randomUUID(),
      type,
      status: 'pending',
      message: options?.message,
      createdAt: new Date().toISOString(),
      metadata: options?.metadata
    }

    this.tasks.set(task.id, task)
    this.broadcastTaskUpdate(task)

    return task
  }

  startTask(taskId: string): Task | null {
    const task = this.tasks.get(taskId)

    if (!task) {
      return null
    }

    task.status = 'running'
    task.startedAt = new Date().toISOString()

    this.broadcastTaskUpdate(task)

    return task
  }

  updateTaskProgress(taskId: string, progress: TaskProgress): Task | null {
    const task = this.tasks.get(taskId)

    if (!task) {
      return null
    }

    task.progress = progress

    this.broadcastTaskUpdate(task)

    return task
  }

  completeTask(taskId: string): Task | null {
    const task = this.tasks.get(taskId)

    if (!task) {
      return null
    }

    task.status = 'completed'
    task.completedAt = new Date().toISOString()

    this.broadcastTaskUpdate(task)
    this.scheduleTaskCleanup(taskId)

    return task
  }

  failTask(taskId: string, error: string): Task | null {
    const task = this.tasks.get(taskId)

    if (!task) {
      return null
    }

    task.status = 'failed'
    task.error = error
    task.completedAt = new Date().toISOString()

    this.broadcastTaskUpdate(task)
    this.scheduleTaskCleanup(taskId)

    return task
  }

  getTask(taskId: string): Task | null {
    return this.tasks.get(taskId) ?? null
  }

  getTasks(): Task[] {
    return Array.from(this.tasks.values())
  }

  private broadcastTaskUpdate(task: Task): void {
    this.mainWindow?.webContents.send(ipcChannels.TaskUpdate, { task })
  }

  private scheduleTaskCleanup(taskId: string, delayMs = 30000): void {
    setTimeout(() => {
      this.tasks.delete(taskId)
    }, delayMs)
  }
}

export const taskManager = new TaskManager()
