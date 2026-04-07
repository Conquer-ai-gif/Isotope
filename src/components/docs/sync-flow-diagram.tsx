'use client'

import { ArrowRightIcon, ArrowLeftIcon, GithubIcon, SparklesIcon } from 'lucide-react'

export function SyncFlowDiagram() {
  return (
    <div className="rounded-xl border border-border bg-card p-6 my-6">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-6 text-center">GitHub Two-Way Sync</p>
      <div className="flex items-center justify-center gap-3 flex-wrap">

        {/* Luno -->  GitHub */}
        <div className="flex flex-col items-center gap-2">
          <div className="size-14 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
            <SparklesIcon className="size-6 text-primary" />
          </div>
          <span className="text-xs font-medium text-foreground">Luno</span>
        </div>

        <div className="flex flex-col items-center gap-1">
          <div className="flex items-center gap-1 text-green-400">
            <ArrowRightIcon className="size-4" />
          </div>
          <span className="text-[10px] text-green-400 font-medium">auto-push</span>
          <div className="flex items-center gap-1 text-blue-400">
            <ArrowLeftIcon className="size-4" />
          </div>
          <span className="text-[10px] text-blue-400 font-medium">pull commits</span>
        </div>

        <div className="flex flex-col items-center gap-2">
          <div className="size-14 rounded-xl bg-muted border border-border flex items-center justify-center">
            <GithubIcon className="size-6 text-foreground" />
          </div>
          <span className="text-xs font-medium text-foreground">GitHub</span>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3">
        <div className="rounded-lg bg-green-500/5 border border-green-500/20 p-3">
          <p className="text-xs font-semibold text-green-400 mb-1">Luno → GitHub</p>
          <p className="text-xs text-muted-foreground">Every generation auto-pushes to your connected repo as a new commit</p>
        </div>
        <div className="rounded-lg bg-blue-500/5 border border-blue-500/20 p-3">
          <p className="text-xs font-semibold text-blue-400 mb-1">GitHub → Luno</p>
          <p className="text-xs text-muted-foreground">Commits pushed directly to GitHub are pulled back into Luno automatically</p>
        </div>
      </div>
    </div>
  )
}
