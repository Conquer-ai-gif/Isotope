'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTRPC } from '@/trpc/client'
import {
  CheckIcon, XIcon, FileIcon, PlusIcon, EditIcon,
  PackageIcon, ClockIcon, Loader2Icon, DatabaseIcon,
  FolderIcon, AlertTriangleIcon, CpuIcon, LayoutIcon, ServerIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

// ── Types matching the upgraded PLAN_PROMPT JSON schema ──────────────────────

interface SchemaField { name: string; type: string; note?: string }
interface ProposedTable { table: string; fields: SchemaField[] }
interface FolderEntry { path: string; type: 'file' | 'dir'; note?: string }
interface MemoryStats { filesInContext: number; estimatedTokens: number; architectureMapAvailable: boolean }

interface PlanData {
  summary: string
  approach: string
  complexity: 'simple' | 'medium' | 'complex'
  estimatedTime: string
  agentPlan?: 'ui_only' | 'backend_only' | 'both'
  filesToCreate: { path: string; description: string; agent?: string }[]
  filesToModify: { path: string; description: string; agent?: string }[]
  dependencies: string[]
  proposedSchema?: ProposedTable[]
  folderStructure?: FolderEntry[]
  memoryStats?: MemoryStats
  riskFlags?: string[]
}

const COMPLEXITY_STYLES = {
  simple:  'bg-green-500/10 text-green-400 border-green-500/20',
  medium:  'bg-amber-500/10 text-amber-400 border-amber-500/20',
  complex: 'bg-red-500/10 text-red-400 border-red-500/20',
}

const AGENT_STYLES: Record<string, string> = {
  ui:      'text-blue-400',
  backend: 'text-purple-400',
  both:    'text-teal-400',
}

interface Props {
  messageId: string
  planJson: string
  onApproved: () => void
  onRejected: () => void
}

export function PlanApproval({ messageId, planJson, onApproved, onRejected }: Props) {
  const trpc = useTRPC()
  const queryClient = useQueryClient()

  let plan: PlanData | null = null
  try { plan = JSON.parse(planJson) } catch { return null }
  if (!plan) return null

  const approve = useMutation(trpc.messages.approvePlan.mutationOptions({
    onSuccess: () => { toast.success('Plan approved — generating your app...'); onApproved() },
    onError: (e) => toast.error(e.message),
  }))

  const reject = useMutation(trpc.messages.rejectPlan.mutationOptions({
    onSuccess: () => { toast.info('Plan rejected — your credit has been refunded'); onRejected() },
    onError: (e) => toast.error(e.message),
  }))

  const isPending = approve.isPending || reject.isPending

  return (
    <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-4 max-w-2xl">

      {/* ── Header ── */}
      <div className="flex items-start gap-3">
        <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
          <FileIcon className="size-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">Here's my plan</p>
          <p className="text-sm text-muted-foreground mt-0.5">{plan.summary}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {plan.agentPlan && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground border capitalize">
              {plan.agentPlan === 'ui_only' ? '🎨 UI' : plan.agentPlan === 'backend_only' ? '⚙️ Backend' : '🔀 Full Stack'}
            </span>
          )}
          <div className={cn('text-xs font-medium px-2 py-1 rounded-full border capitalize', COMPLEXITY_STYLES[plan.complexity])}>
            {plan.complexity}
          </div>
        </div>
      </div>

      {/* ── Approach ── */}
      <p className="text-xs text-muted-foreground leading-relaxed border-l-2 border-primary/20 pl-3">
        {plan.approach}
      </p>

      {/* ── FEATURE 10: Memory Stats ── */}
      {plan.memoryStats && (
        <div className="flex items-center gap-4 text-xs text-muted-foreground bg-muted/40 rounded-lg px-3 py-2">
          <span className="flex items-center gap-1.5">
            <CpuIcon className="size-3.5" />
            {plan.memoryStats.filesInContext} files in context
          </span>
          <span className="text-muted-foreground/40">·</span>
          <span>~{plan.memoryStats.estimatedTokens.toLocaleString()} tokens</span>
          <span className="text-muted-foreground/40">·</span>
          <span className={plan.memoryStats.architectureMapAvailable ? 'text-green-400' : 'text-muted-foreground'}>
            {plan.memoryStats.architectureMapAvailable ? '✓ Architecture map' : 'No architecture map'}
          </span>
        </div>
      )}

      {/* ── Risk Flags ── */}
      {plan.riskFlags && plan.riskFlags.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
            <AlertTriangleIcon className="size-3.5" /> Risk flags
          </p>
          {plan.riskFlags.map((flag, i) => (
            <div key={i} className="flex items-start gap-2 text-xs text-amber-300/80">
              <span className="mt-0.5 flex-shrink-0">⚠</span>
              <span>{flag}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── Files to create ── */}
      {plan.filesToCreate.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Files to create</p>
          {plan.filesToCreate.map((f) => (
            <div key={f.path} className="flex items-start gap-2 text-xs">
              <PlusIcon className="size-3.5 text-green-400 flex-shrink-0 mt-0.5" />
              <span className="font-mono text-green-400">{f.path}</span>
              {f.agent && <span className={cn('text-xs', AGENT_STYLES[f.agent] ?? 'text-muted-foreground')}>[{f.agent}]</span>}
              <span className="text-muted-foreground">— {f.description}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── Files to modify ── */}
      {plan.filesToModify.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Files to modify</p>
          {plan.filesToModify.map((f) => (
            <div key={f.path} className="flex items-start gap-2 text-xs">
              <EditIcon className="size-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
              <span className="font-mono text-amber-400">{f.path}</span>
              {f.agent && <span className={cn('text-xs', AGENT_STYLES[f.agent] ?? 'text-muted-foreground')}>[{f.agent}]</span>}
              <span className="text-muted-foreground">— {f.description}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── FEATURE 3: Proposed DB Schema ── */}
      {plan.proposedSchema && plan.proposedSchema.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <DatabaseIcon className="size-3.5" /> Proposed schema
          </p>
          {plan.proposedSchema.map((table) => (
            <div key={table.table} className="rounded-lg border border-border bg-muted/30 p-3 space-y-1.5">
              <p className="text-xs font-mono font-semibold text-foreground">{table.table}</p>
              <div className="space-y-0.5">
                {table.fields.map((f) => (
                  <div key={f.name} className="flex items-center gap-2 text-xs">
                    <span className="font-mono text-blue-400 w-28 truncate">{f.name}</span>
                    <span className="text-muted-foreground">{f.type}</span>
                    {f.note && <span className="text-muted-foreground/60 italic">{f.note}</span>}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── FEATURE 3: Folder Structure ── */}
      {plan.folderStructure && plan.folderStructure.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <FolderIcon className="size-3.5" /> Folder structure
          </p>
          <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-1">
            {plan.folderStructure.map((entry) => (
              <div key={entry.path} className="flex items-center gap-2 text-xs">
                {entry.type === 'dir'
                  ? <FolderIcon className="size-3 text-amber-400 flex-shrink-0" />
                  : <FileIcon className="size-3 text-muted-foreground flex-shrink-0" />}
                <span className={cn('font-mono', entry.type === 'dir' ? 'text-amber-400' : 'text-muted-foreground')}>
                  {entry.path}
                </span>
                {entry.note && (
                  <span className="text-green-400 text-xs">{entry.note}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Dependencies ── */}
      {plan.dependencies.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">New dependencies</p>
          <div className="flex flex-wrap gap-1.5">
            {plan.dependencies.map((dep) => (
              <span key={dep} className="flex items-center gap-1 text-xs bg-muted px-2 py-0.5 rounded-full text-muted-foreground">
                <PackageIcon className="size-3" />{dep}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── Estimated time ── */}
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <ClockIcon className="size-3.5" />
        Estimated: {plan.estimatedTime}
      </div>

      {/* ── Actions ── */}
      <div className="flex gap-2 pt-1">
        <Button size="sm" onClick={() => approve.mutate({ messageId })} disabled={isPending} className="gap-1.5">
          {approve.isPending ? <Loader2Icon className="size-3.5 animate-spin" /> : <CheckIcon className="size-3.5" />}
          Approve & Build
        </Button>
        <Button size="sm" variant="outline" onClick={() => reject.mutate({ messageId })} disabled={isPending} className="gap-1.5">
          {reject.isPending ? <Loader2Icon className="size-3.5 animate-spin" /> : <XIcon className="size-3.5" />}
          Edit prompt
        </Button>
      </div>
    </div>
  )
}
