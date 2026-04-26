interface ScheduledIdleTask {
  cancel: () => void
}

export function scheduleIdleTask(
  task: () => void,
  timeout = 1000
): ScheduledIdleTask {
  if (
    typeof window !== 'undefined' &&
    typeof window.requestIdleCallback === 'function'
  ) {
    const handle = window.requestIdleCallback(task, { timeout })

    return {
      cancel: () => {
        window.cancelIdleCallback(handle)
      }
    }
  }

  const handle = window.setTimeout(task, 16)

  return {
    cancel: () => {
      window.clearTimeout(handle)
    }
  }
}
