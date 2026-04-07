'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTRPC } from '@/trpc/client'
import { GitBranchIcon, GitMergeIcon, Trash2Icon, Loader2Icon, CheckCircleIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface Props {
  fragmentId: string
  branchName: string
  branchMerged: boolean
  projectId: string
}

export function BranchManager({ fragmentId, branchName, branchMerged, projectId }: Props) {
  const trpc = useTRPC()
  const queryClient = useQueryClient()

  const invalidate = () => {
    queryClient.invalidateQueries(trpc.messages.getMany.queryOptions({ projectId }))
  }

  const merge = useMutation(trpc.projects.mergeBranch.mutationOptions({
    onSuccess: () => {
      toast.success(`Branch merged to main`)
      invalidate()
    },
    onError: (e) => toast.error(e.message),
  }))

  const discard = useMutation(trpc.projects.discardBranch.mutationOptions({
    onSuccess: () => {
      toast.info('Branch discarded')
      invalidate()
    },
    onError: (e) => toast.error(e.message),
  }))

  const isPending = merge.isPending || discard.isPending
  const shortBranch = branchName.replace('luno/', '')

  if (branchMerged) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-green-400">
        <CheckCircleIcon className="size-3.5" />
        Merged to main
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full">
        <GitBranchIcon className="size-3" />
        <span className="font-mono truncate max-w-[180px]">{shortBranch}</span>
      </div>

      <Button
        size="sm"
        variant="outline"
        className="h-6 text-xs gap-1 px-2"
        onClick={() => merge.mutate({ fragmentId })}
        disabled={isPending}
      >
        {merge.isPending
          ? <Loader2Icon className="size-3 animate-spin" />
          : <GitMergeIcon className="size-3" />
        }
        Merge
      </Button>

      <Button
        size="sm"
        variant="outline"
        className="h-6 text-xs gap-1 px-2 text-destructive hover:text-destructive"
        onClick={() => discard.mutate({ fragmentId })}
        disabled={isPending}
      >
        {discard.isPending
          ? <Loader2Icon className="size-3 animate-spin" />
          : <Trash2Icon className="size-3" />
        }
        Discard
      </Button>
    </div>
  )
}
