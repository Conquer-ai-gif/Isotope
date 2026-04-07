import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Marketplace',
  description: 'Browse community-built app templates. Fork any template and customize it with AI in seconds.',
}

'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { useTRPC } from '@/trpc/client'
import { toast } from 'sonner'
import {
  SearchIcon, HeartIcon, RocketIcon, StarIcon,
  Loader2Icon, TrendingUpIcon, ClockIcon, FlameIcon,
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { formatDistanceToNow } from 'date-fns'
import { useAuth } from '@clerk/nextjs'

const CATEGORIES = ['All', 'Productivity', 'E-commerce', 'Social', 'Dashboard', 'Landing Page', 'Entertainment', 'Tools', 'Other'] as const

const SORT_OPTIONS = [
  { value: 'popular', label: 'Most used',   icon: FlameIcon },
  { value: 'liked',   label: 'Most liked',  icon: HeartIcon },
  { value: 'newest',  label: 'Newest',      icon: ClockIcon },
] as const

export default function MarketplacePage() {
  const trpc        = useTRPC()
  const router      = useRouter()
  const queryClient = useQueryClient()
  const { userId }  = useAuth()

  const [search,   setSearch]   = useState('')
  const [category, setCategory] = useState('All')
  const [sort,     setSort]     = useState<'popular' | 'liked' | 'newest'>('popular')
  const [forking,  setForking]  = useState<string | null>(null)

  const { data, isLoading } = useQuery(
    trpc.marketplace.list.queryOptions({ search, category, sort, take: 24 }),
  )

  const createProject = useMutation(trpc.projects.create.mutationOptions({
    onSuccess: (data) => {
      queryClient.invalidateQueries(trpc.projects.getMany.queryOptions())
      router.push(`/projects/${data.id}`)
    },
    onError: (e) => {
      toast.error(e.message)
      setForking(null)
    },
  }))

  const fork = useMutation(trpc.marketplace.fork.mutationOptions({
    onSuccess: (data) => {
      createProject.mutate({ value: data.prompt })
    },
    onError: (e) => {
      toast.error(e.message)
      setForking(null)
    },
  }))

  const like   = useMutation(trpc.marketplace.like.mutationOptions({
    onSuccess: () => queryClient.invalidateQueries(trpc.marketplace.list.queryOptions({ search, category, sort, take: 24 })),
  }))
  const unlike = useMutation(trpc.marketplace.unlike.mutationOptions({
    onSuccess: () => queryClient.invalidateQueries(trpc.marketplace.list.queryOptions({ search, category, sort, take: 24 })),
  }))

  const handleFork = (templateId: string, prompt: string) => {
    if (!userId) { router.push('/sign-up'); return }
    setForking(templateId)
    fork.mutate({ templateId })
  }

  return (
    <div className="max-w-6xl mx-auto w-full px-4 py-8">
      {/* Header */}
      <div className="mb-8 space-y-1">
        <h1 className="text-3xl font-bold">Community Marketplace</h1>
        <p className="text-muted-foreground">
          Browse apps built by the community. Fork any template and make it your own.
        </p>
      </div>

      {/* Search + sort */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1 max-w-sm">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search templates..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-1.5">
          {SORT_OPTIONS.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              onClick={() => setSort(value)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                sort === value
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:text-foreground',
              )}
            >
              <Icon className="size-3.5" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Category pills */}
      <div className="flex flex-wrap gap-2 mb-6">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setCategory(cat)}
            className={cn(
              'px-3 py-1.5 rounded-full text-sm font-medium transition-colors',
              category === cat
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground',
            )}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Count */}
      {data && (
        <p className="text-xs text-muted-foreground mb-4">
          {data.total} template{data.total !== 1 ? 's' : ''}
          {category !== 'All' ? ` in ${category}` : ''}
          {search ? ` matching "${search}"` : ''}
        </p>
      )}

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-48 rounded-xl border bg-card animate-pulse" />
          ))}
        </div>
      ) : data?.items.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <p className="text-4xl mb-3">🔍</p>
          <p className="font-medium">No templates found</p>
          <p className="text-sm mt-1">Try a different search or category</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {data?.items.map((template) => {
            const isForkingThis = forking === template.id

            return (
              <div
                key={template.id}
                className="group relative flex flex-col border rounded-xl p-5 bg-card hover:border-primary/40 transition-all"
              >
                {/* Featured badge */}
                {template.featured && (
                  <div className="absolute -top-2.5 left-4">
                    <span className="flex items-center gap-1 text-[10px] font-semibold bg-primary text-primary-foreground px-2 py-0.5 rounded-full">
                      <StarIcon className="size-2.5" /> Featured
                    </span>
                  </div>
                )}

                {/* Emoji + category */}
                <div className="flex items-start justify-between mb-3">
                  <span className="text-3xl">{template.emoji}</span>
                  <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                    {template.category}
                  </span>
                </div>

                {/* Title + description */}
                <h3 className="font-semibold mb-1 line-clamp-1">{template.title}</h3>
                <p className="text-sm text-muted-foreground flex-1 mb-4 leading-relaxed line-clamp-2">
                  {template.description}
                </p>

                {/* Stats */}
                <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3">
                  <span className="flex items-center gap-1">
                    <RocketIcon className="size-3" />
                    {template.useCount} uses
                  </span>
                  <span className="flex items-center gap-1">
                    <HeartIcon className="size-3" />
                    {template.likeCount} likes
                  </span>
                  <span className="ml-auto">
                    {formatDistanceToNow(new Date(template.createdAt), { addSuffix: true })}
                  </span>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <button
                    onClick={() => handleFork(template.id, template.prompt)}
                    disabled={!!forking}
                    className={cn(
                      'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-colors',
                      isForkingThis
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground group-hover:bg-primary group-hover:text-primary-foreground',
                      forking && !isForkingThis && 'opacity-50 cursor-not-allowed',
                    )}
                  >
                    {isForkingThis
                      ? <><Loader2Icon className="size-3.5 animate-spin" /> Forking...</>
                      : 'Use template →'
                    }
                  </button>
                  <button
                    onClick={() => like.mutate({ templateId: template.id })}
                    className="size-9 flex items-center justify-center rounded-lg bg-muted text-muted-foreground hover:text-red-400 hover:bg-red-400/10 transition-colors"
                  >
                    <HeartIcon className="size-4" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Empty state CTA */}
      {data && data.total === 0 && !search && category === 'All' && (
        <div className="text-center py-20 space-y-3">
          <p className="text-4xl">🚀</p>
          <p className="font-medium">No community templates yet</p>
          <p className="text-sm text-muted-foreground">Be the first to publish one from your projects!</p>
        </div>
      )}
    </div>
  )
}
