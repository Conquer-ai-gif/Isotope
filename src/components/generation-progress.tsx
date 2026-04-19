'use client'

import { useGenerationStream } from '@/hooks/use-generation-stream'
import type { ExecutionEventType } from '@/streaming/events'
import Image from 'next/image'

interface Props {
  messageId: string | null
}

type TaskState = {
  id: string
  status: 'pending' | 'running' | 'done' | 'failed' | 'fixing'
  type?: string
}

const STATUS_LABEL: Record<TaskState['status'], string> = {
  pending: 'Waiting',
  running: 'Building',
  done: 'Done',
  failed: 'Failed',
  fixing: 'Fixing',
}

const STATUS_COLOR: Record<TaskState['status'], string> = {
  pending: 'bg-muted text-muted-foreground',
  running: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
  done: 'bg-green-500/15 text-green-600 dark:text-green-400',
  failed: 'bg-red-500/15 text-red-500',
  fixing: 'bg-yellow-500/15 text-yellow-600 dark:text-yellow-400',
}

const PULSING: Partial<Record<TaskState['status'], boolean>> = {
  running: true,
  fixing: true,
}

/** Map raw stream event types to human-readable log labels */
function eventLabel(type: ExecutionEventType): string | null {
  switch (type) {
    case 'generation_started': return 'Starting generation…'
    case 'task_started':       return 'Running task…'
    case 'task_completed':     return 'Task complete'
    case 'task_failed':        return 'Task failed — retrying'
    case 'validation_started': return 'Type-checking…'
    case 'validation_passed':  return 'No type errors'
    case 'validation_failed':  return 'Type errors found'
    case 'fix_started':        return 'Auto-fixing errors…'
    case 'fix_completed':      return 'Errors fixed'
    case 'generation_completed': return 'Generation complete'
    case 'generation_failed':  return 'Generation failed'
    default:                   return null
  }
}

export function GenerationProgress({ messageId }: Props) {
  const { events, status, latestLog } = useGenerationStream(messageId)

  // Build a deduplicated map of tasks from the event stream
  const taskMap = new Map<string, TaskState>()

  for (const ev of events) {
    if (!ev.taskId) continue

    const existing = taskMap.get(ev.taskId) ?? {
      id: ev.taskId,
      status: 'pending' as TaskState['status'],
      type: ev.data?.type as string | undefined,
    }

    switch (ev.type) {
      case 'task_started':
        taskMap.set(ev.taskId, { ...existing, status: 'running', type: (ev.data?.type as string) ?? existing.type })
        break
      case 'validation_started':
      case 'fix_started':
        taskMap.set(ev.taskId, { ...existing, status: 'fixing' })
        break
      case 'task_completed':
      case 'validation_passed':
        taskMap.set(ev.taskId, { ...existing, status: 'done' })
        break
      case 'task_failed':
        taskMap.set(ev.taskId, { ...existing, status: 'failed' })
        break
      default:
        if (!taskMap.has(ev.taskId)) taskMap.set(ev.taskId, existing)
    }
  }

  const tasks = Array.from(taskMap.values())
  const total = tasks.length
  const done = tasks.filter((t) => t.status === 'done').length
  const progressPct = total > 0 ? Math.round((done / total) * 90) : 10

  // Latest human-readable log line
  const displayLog = (() => {
    if (latestLog) return latestLog
    const lastMeaningful = [...events].reverse().find((e) => eventLabel(e.type))
    return lastMeaningful ? eventLabel(lastMeaningful.type) : 'Starting…'
  })()

  return (
    <div className="flex flex-col gap-3 px-4 py-3 w-full max-w-lg">
      {/* Header */}
      <div className="flex items-center gap-2.5">
        <div className="shrink-0 size-7 rounded-full bg-foreground flex items-center justify-center">
          <Image src="/logo.svg" alt="Isotope" width={14} height={14} />
        </div>
        <span className="text-sm font-medium text-foreground">Isotope</span>
        {status === 'streaming' && (
          <span className="ml-auto text-xs text-muted-foreground animate-pulse">
            Generating…
          </span>
        )}
      </div>

      {/* Progress bar */}
      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full bg-primary transition-all duration-500 ease-out"
          style={{ width: status === 'completed' ? '100%' : `${progressPct}%` }}
        />
      </div>

      {/* Status line */}
      <p className="text-xs text-muted-foreground truncate">{displayLog}</p>

      {/* Task list — only renders once we have tasks from the stream */}
      {tasks.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {tasks.map((task) => (
            <li key={task.id} className="flex items-center gap-2">
              <span
                className={[
                  'shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded',
                  STATUS_COLOR[task.status],
                  PULSING[task.status] ? 'animate-pulse' : '',
                ].join(' ')}
              >
                {STATUS_LABEL[task.status]}
              </span>
              <span className="text-xs text-muted-foreground truncate">
                {task.type ? `${task.type} — ` : ''}{task.id}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
