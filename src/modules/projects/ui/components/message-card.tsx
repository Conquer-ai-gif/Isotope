'use client'

import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Fragment, MessageRole, MessageType } from '@/generated/prisma/client'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import { ChevronRightIcon, Code2Icon, RefreshCcwIcon, AlertCircleIcon, SparklesIcon } from 'lucide-react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query'
import { useTRPC } from '@/trpc/client'
import { toast } from 'sonner'
import { PlanApproval } from './plan-approval'
import { BranchManager } from './branch-manager'

interface UserMessageProps { content: string; imageUrl?: string | null }

const UserMessage = ({ content, imageUrl }: UserMessageProps) => (
  <div className="flex justify-end pb-4 pr-2 pl-10">
    <div className="flex flex-col gap-1.5 max-w-[80%]">
      {imageUrl && (
        <img src={imageUrl} alt="Attached" className="rounded-lg max-h-48 object-contain self-end border" />
      )}
      <Card className="rounded-lg bg-muted p-3 shadow-none border-none break-words text-sm">
        {content}
      </Card>
    </div>
  </div>
)

interface FragmentCardProps {
  fragment: Fragment
  isActiveFragment: boolean
  onFragmentClick: (fragment: Fragment) => void
}

const FragmentCard = ({ fragment, isActiveFragment, onFragmentClick }: FragmentCardProps) => (
  <div className="flex flex-col gap-2">
    <button
      className={cn(
        'flex items-start text-start gap-2 border rounded-lg bg-muted w-fit p-3 hover:bg-secondary transition-colors',
        isActiveFragment && 'bg-primary text-primary-foreground border-primary hover:bg-primary/90',
      )}
      onClick={() => onFragmentClick(fragment)}
    >
      <Code2Icon className="size-4 mt-0.5 flex-shrink-0" />
      <div className="flex flex-col flex-1">
        <span className="text-sm font-medium line-clamp-1">{fragment.title}</span>
        <span className="text-xs opacity-70">Click to preview</span>
      </div>
      <ChevronRightIcon className="size-4 mt-0.5" />
    </button>

    {/* Branch manager — only shows if fragment has a branch */}
    {fragment.branchName && (
      <BranchManager
        fragmentId={fragment.id}
        branchName={fragment.branchName}
        branchMerged={fragment.branchMerged}
        projectId={fragment.message?.projectId ?? ''}
      />
    )}
  </div>
)

interface SuggestionsProps {
  projectId: string
  summary: string
  onSelect: (prompt: string) => void
}

const Suggestions = ({ projectId, summary, onSelect }: SuggestionsProps) => {
  const trpc = useTRPC()
  const { data, isLoading } = useQuery({
    ...trpc.messages.getSuggestions.queryOptions({ projectId, summary }),
    staleTime: Infinity,
    retry: false,
  })

  const suggestions = data?.suggestions ?? []

  if (isLoading) return null
  if (suggestions.length === 0) return null

  return (
    <div className="flex flex-wrap gap-2 mt-1">
      {suggestions.map((s, i) => (
        <button
          key={i}
          onClick={() => onSelect(s)}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border border-primary/30 bg-primary/5 text-primary hover:bg-primary/10 transition-colors"
        >
          <SparklesIcon className="size-3 flex-shrink-0" />
          {s}
        </button>
      ))}
    </div>
  )
}

interface AssistantMessageProps {
  content: string
  fragment: Fragment | null
  createdAt: Date
  isActiveFragment: boolean
  onFragmentClick: (fragment: Fragment) => void
  type: MessageType
  projectId: string
  isLatest: boolean
  onSuggestionSelect: (prompt: string) => void
  // Plan-first props
  messageId: string
  plan?: string | null
  planStatus?: string | null
}

const AssistantMessage = ({
  content, fragment, createdAt, isActiveFragment, onFragmentClick,
  type, projectId, isLatest, onSuggestionSelect,
  messageId, plan, planStatus,
}: AssistantMessageProps) => {
  const trpc = useTRPC()
  const router = useRouter()
  const queryClient = useQueryClient()

  const retryGeneration = useMutation(trpc.messages.create.mutationOptions({
    onSuccess: () => {
      queryClient.invalidateQueries(trpc.messages.getMany.queryOptions({ projectId }))
      toast.success('Retrying generation...')
    },
    onError: (e) => {
      if (e?.message?.includes('run out of credits') || e?.data?.code === 'TOO_MANY_REQUESTS') {
        router.push('/pricing')
      } else {
        toast.error(e.message)
      }
    },
  }))

  return (
    <div className={cn('flex flex-col group px-2 pb-4', type === 'ERROR' && 'text-red-700 dark:text-red-500')}>
      <div className="flex items-center gap-2 pl-2 mb-2">
        <Image src="/logo.svg" alt="Isotope" width={18} height={18} className="shrink-0" />
        <span className="text-sm font-medium">Isotope</span>
        <span className="text-xs text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
          {format(createdAt, "HH:mm 'on' MM/dd/yyyy")}
        </span>
      </div>

      <div className="pl-8 flex flex-col gap-y-3">
        {type === 'ERROR' ? (
          <div className="flex flex-col gap-2">
            <div className="flex items-start gap-2">
              <AlertCircleIcon className="size-4 mt-0.5 flex-shrink-0" />
              <span className="text-sm">{content}</span>
            </div>
            <Button
              size="sm" variant="outline"
              className="w-fit text-xs h-7 border-red-300 dark:border-red-800"
              disabled={retryGeneration.isPending}
              onClick={() => retryGeneration.mutate({ projectId, value: 'Please try again' })}
            >
              <RefreshCcwIcon className="size-3" />
              {retryGeneration.isPending ? 'Retrying...' : 'Retry'}
            </Button>
          </div>
        ) : (
          <>
            <span className="text-sm">{content}</span>

            {/* Plan approval — shows when plan is pending */}
            {plan && planStatus === 'pending' && (
              <PlanApproval
                messageId={messageId}
                planJson={plan}
                onApproved={() => {
                  queryClient.invalidateQueries(trpc.messages.getMany.queryOptions({ projectId }))
                }}
                onRejected={() => {
                  queryClient.invalidateQueries(trpc.messages.getMany.queryOptions({ projectId }))
                }}
              />
            )}

            {fragment && (
              <FragmentCard
                fragment={fragment}
                isActiveFragment={isActiveFragment}
                onFragmentClick={onFragmentClick}
              />
            )}

            {/* Suggestions — only on latest successful generation */}
            {isLatest && fragment && planStatus !== 'pending' && (
              <Suggestions
                projectId={projectId}
                summary={`${fragment.title}: ${content}`}
                onSelect={onSuggestionSelect}
              />
            )}
          </>
        )}
      </div>
    </div>
  )
}

interface MessageCardProps {
  content: string
  role: MessageRole
  fragment: Fragment | null
  createdAt: Date
  isActiveFragment: boolean
  onFragmentClick: (fragment: Fragment) => void
  type: MessageType
  projectId: string
  imageUrl?: string | null
  isLatest?: boolean
  onSuggestionSelect?: (prompt: string) => void
  // Plan-first props
  messageId: string
  plan?: string | null
  planStatus?: string | null
}

export const MessageCard = ({
  content, role, fragment, createdAt, isActiveFragment, onFragmentClick,
  type, projectId, imageUrl, isLatest = false, onSuggestionSelect,
  messageId, plan, planStatus,
}: MessageCardProps) => {
  if (role === 'ASSISTANT') {
    return (
      <AssistantMessage
        content={content} fragment={fragment} createdAt={createdAt}
        isActiveFragment={isActiveFragment} onFragmentClick={onFragmentClick}
        type={type} projectId={projectId}
        isLatest={isLatest}
        onSuggestionSelect={onSuggestionSelect ?? (() => {})}
        messageId={messageId}
        plan={plan}
        planStatus={planStatus}
      />
    )
  }
  return <UserMessage content={content} imageUrl={imageUrl} />
}
