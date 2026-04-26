import { useEffect, useState, type ReactElement } from 'react'

import { useFpsCounterVisible } from '@/app/lib/fps-counter-state'

export function FpsCounter(): ReactElement | null {
  const isVisible = useFpsCounterVisible()
  const [fps, setFps] = useState(0)

  useEffect(() => {
    if (!isVisible) {
      return
    }

    let animationFrameHandle = 0
    let frameCount = 0
    let lastTimestamp: number | null = null

    const measureFrame = (timestamp: number) => {
      if (lastTimestamp === null) {
        lastTimestamp = timestamp
      } else {
        frameCount += 1

        const elapsed = timestamp - lastTimestamp

        if (elapsed >= 1000) {
          setFps(Math.round((frameCount * 1000) / elapsed))
          frameCount = 0
          lastTimestamp = timestamp
        }
      }

      animationFrameHandle = window.requestAnimationFrame(measureFrame)
    }

    animationFrameHandle = window.requestAnimationFrame(measureFrame)

    return () => {
      window.cancelAnimationFrame(animationFrameHandle)
    }
  }, [isVisible])

  if (!isVisible) {
    return null
  }

  return (
    <div className="fixed top-3 right-3 z-50 rounded-md border border-border bg-background/90 px-2 py-1 font-mono text-xs text-foreground shadow-sm backdrop-blur pointer-events-none">
      {fps} FPS
    </div>
  )
}
