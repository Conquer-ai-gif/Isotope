import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'

const POLL_INTERVAL_MS = 1000         // check DB every 1 second
const MAX_STREAM_DURATION_MS = 600_000 // hard stop at 10 minutes

const TERMINAL_EVENTS = new Set(['generation_completed', 'generation_failed'])

/**
 * GET /api/generation/stream?messageId=xxx
 *
 * Server-Sent Events endpoint.  The client opens this and receives
 * one JSON payload per `data:` line as tasks complete during AI generation.
 *
 * Event shape mirrors ExecutionEvent from src/streaming/events.ts:
 *   { type, taskId?, data?, timestamp }
 */
export async function GET(req: NextRequest) {
  const messageId = req.nextUrl.searchParams.get('messageId')

  if (!messageId) {
    return new Response('Missing messageId query param', { status: 400 })
  }

  let lastSeq = 0
  let done = false
  const startedAt = Date.now()

  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder()

      const send = (payload: string) => {
        try {
          controller.enqueue(enc.encode(`data: ${payload}\n\n`))
        } catch {
          done = true
        }
      }

      // Send a comment frame every 20s to prevent proxy timeouts
      const keepalive = setInterval(() => {
        try {
          controller.enqueue(enc.encode(': keepalive\n\n'))
        } catch {
          done = true
        }
      }, 20_000)

      while (!done && Date.now() - startedAt < MAX_STREAM_DURATION_MS) {
        try {
          const events = await prisma.generationEvent.findMany({
            where: { messageId, seq: { gt: lastSeq } },
            orderBy: { seq: 'asc' },
            take: 50,
          })

          for (const ev of events) {
            send(
              JSON.stringify({
                type: ev.type,
                taskId: ev.taskId ?? undefined,
                data: ev.data ?? undefined,
                timestamp: ev.createdAt.getTime(),
              }),
            )
            lastSeq = ev.seq

            if (TERMINAL_EVENTS.has(ev.type)) {
              done = true
              break
            }
          }
        } catch (err) {
          console.error('[stream] DB poll error:', err)
        }

        if (!done) {
          await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS))
        }
      }

      clearInterval(keepalive)
      try { controller.close() } catch { /* already closed */ }
    },

    cancel() {
      done = true
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type':  'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection':    'keep-alive',
      'X-Accel-Buffering': 'no', // disable nginx buffering
    },
  })
}
