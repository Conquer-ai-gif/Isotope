import { z } from 'zod'

export type TaskStatus = 'pending' | 'running' | 'done' | 'failed'
export type TaskType = 'ui' | 'backend' | 'db' | 'integration'

export const TaskSchema = z.object({
  id: z.string(),
  type: z.enum(['ui', 'backend', 'db', 'integration']),
  description: z.string().min(1),
  files: z.array(z.string()),
  dependsOn: z.array(z.string()),
  priority: z.number().int().min(1),
  status: z.enum(['pending', 'running', 'done', 'failed']).optional(),
  attempts: z.number().int().optional(),
})

export const TaskGraphSchema = z.object({
  tasks: z
    .array(TaskSchema)
    .min(1)
    .max(15)
    .refine(
      (tasks) => {
        const ids = new Set(tasks.map((t) => t.id))
        for (const t of tasks) {
          for (const dep of t.dependsOn) {
            if (!ids.has(dep)) return false
          }
        }
        return true
      },
      { message: 'dependsOn references a task id that does not exist' },
    )
    .refine(
      (tasks) => {
        const seen = new Set<string>()
        for (const t of tasks) {
          for (const f of t.files) {
            if (seen.has(f)) return false
            seen.add(f)
          }
        }
        return true
      },
      { message: 'A file is owned by more than one task' },
    ),
})

export type Task = z.infer<typeof TaskSchema>
export type TaskGraph = z.infer<typeof TaskGraphSchema>
