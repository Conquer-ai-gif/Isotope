import { useState, useEffect, useRef } from 'react'
import type { ExecutionEventType } from '@/streaming/events'

export interface StreamEvent {
  type: ExecutionEventType
  taskId?: string
  data?: Record<string, unknown>
  timestamp: number
}

export type StreamStatus = 'idle' | 'streaming' | 'completed' | 'failed'

export interface GenerationStreamState {
  events: StreamEvent[]
  status: StreamStatus
  /** ID of the task currently being executed, if any */
  currentTaskId: string | undefined
  /** Latest log message from the generation */
  latestLog: string | undefined
}

/**
 * Subscribes to live generation progress for a given messageId.
 *
 * Usage:
 *   const { events, status, currentTaskId } = useGenerationStream(messageId)
 *
 * Pass `null` to keep the hook dormant (no connection opened).
 */
export function useGenerationStream(messageId: string | null): GenerationStreamState {
  const [state, setState] = useState<GenerationStreamState>({
    events: [],
    status: 'idle',
    currentTaskId: undefined,
    latestLog: undefined,
  })

  const esRef = useRef<EventSource | null>(null)

  useEffect(() => {
    if (!messageId) {
      setState({ events: [], status: 'idle', currentTaskId: undefined, latestLog: undefined })
      return
    }

    // Reset state for the new messageId
    setState({ events: [], status: 'streaming', currentTaskId: undefined, latestLog: undefined })

    const es = new EventSource(`/api/generation/stream?messageId=${encodeURIComponent(messageId)}`)
    esRef.current = es

    es.onmessage = (e: MessageEvent) => {
      try {
        const event = JSON.parse(e.data as string) as StreamEvent
        setState((prev) => {
          const events = [...prev.events, event]

          let status: StreamStatus = prev.status
          let currentTaskId = prev.currentTaskId
          let latestLog = prev.latestLog

          switch (event.type) {
            case 'generation_completed':
              status = 'completed'
              break
            case 'generation_failed':
              status = 'failed'
              break
            case 'task_started':
              currentTaskId = event.taskId
              break
            case 'task_completed':
            case 'task_failed':
              if (currentTaskId === event.taskId) currentTaskId = undefined
              break
            case 'log':
              latestLog = (event.data?.message as string) ?? latestLog
              break
          }

          return { events, status, currentTaskId, latestLog }
        })
      } catch {
        // Ignore parse errors (keepalive comments etc.)
      }
    }

    es.onerror = () => {
      setState((prev) =>
        prev.status === 'streaming' ? { ...prev, status: 'failed' } : prev,
      )
      es.close()
    }

    return () => {
      es.close()
      esRef.current = null
    }
  }, [messageId])

  return state
}
