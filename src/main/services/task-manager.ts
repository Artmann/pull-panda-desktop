import { Context, Effect, Layer } from 'effect'

import { taskManager } from '../task-manager'
import type { Task, TaskProgress, TaskType } from '../../types/task'

export class TaskManagerService extends Context.Tag('main/TaskManager')<
  TaskManagerService,
  {
    readonly complete: (taskId: string) => Effect.Effect<Task | null>
    readonly create: (input: {
      readonly type: TaskType
      readonly message?: string
      readonly metadata?: Record<string, unknown>
    }) => Effect.Effect<Task>
    readonly fail: (input: {
      readonly error: string
      readonly taskId: string
    }) => Effect.Effect<Task | null>
    readonly get: (taskId: string) => Effect.Effect<Task | null>
    readonly list: Effect.Effect<ReadonlyArray<Task>>
    readonly start: (taskId: string) => Effect.Effect<Task | null>
    readonly updateProgress: (input: {
      readonly progress: TaskProgress
      readonly taskId: string
    }) => Effect.Effect<Task | null>
  }
>() {}

export const TaskManagerLive: Layer.Layer<TaskManagerService> = Layer.succeed(
  TaskManagerService,
  {
    create: ({ type, message, metadata }) =>
      Effect.sync(() => taskManager.createTask(type, { message, metadata })),
    start: (taskId) => Effect.sync(() => taskManager.startTask(taskId)),
    updateProgress: ({ progress, taskId }) =>
      Effect.sync(() => taskManager.updateTaskProgress(taskId, progress)),
    complete: (taskId) => Effect.sync(() => taskManager.completeTask(taskId)),
    fail: ({ error, taskId }) =>
      Effect.sync(() => taskManager.failTask(taskId, error)),
    get: (taskId) => Effect.sync(() => taskManager.getTask(taskId)),
    list: Effect.sync(() => taskManager.getTasks())
  }
)
