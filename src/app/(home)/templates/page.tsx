import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Templates',
  description: 'Start building instantly with pre-built app templates. E-commerce, dashboards, landing pages, chat apps, and more — one click to generate.',
}

'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2Icon, SearchIcon } from 'lucide-react'

import { useTRPC } from '@/trpc/client'
import { PROJECT_TEMPLATES, TEMPLATE_CATEGORIES, type Template } from '@/modules/home/constants'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

export default function TemplatesPage() {
  const trpc = useTRPC()
  const router = useRouter()
  const queryClient = useQueryClient()

  const [activeCategory, setActiveCategory] = useState<string>('All')
  const [search, setSearch] = useState('')
  const [launchingId, setLaunchingId] = useState<string | null>(null)

  const createProject = useMutation(
    trpc.projects.create.mutationOptions({
      onSuccess: (data) => {
        queryClient.invalidateQueries(trpc.projects.getMany.queryOptions())
        router.push(`/projects/${data.id}`)
      },
      onError: (e) => {
        toast.error(e.message)
        setLaunchingId(null)
      },
    }),
  )

  const handleUse = (template: Template) => {
    setLaunchingId(template.title)
    createProject.mutate({ value: template.prompt })
  }

  const filtered = PROJECT_TEMPLATES.filter((t) => {
    const matchesCategory = activeCategory === 'All' || t.category === activeCategory
    const matchesSearch =
      !search ||
      t.title.toLowerCase().includes(search.toLowerCase()) ||
      t.description.toLowerCase().includes(search.toLowerCase()) ||
      t.category.toLowerCase().includes(search.toLowerCase())
    return matchesCategory && matchesSearch
  })

  return (
    <div className="max-w-6xl mx-auto w-full px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Template gallery</h1>
        <p className="text-muted-foreground">
          Start from a template and customize it with AI — or use it as inspiration for your own idea.
        </p>
      </div>

      {/* Search + filters */}
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
      </div>

      {/* Category pills */}
      <div className="flex flex-wrap gap-2 mb-6">
        {TEMPLATE_CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={cn(
              'px-3 py-1.5 rounded-full text-sm font-medium transition-colors',
              activeCategory === cat
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground',
            )}
          >
            {cat}
            {cat !== 'All' && (
              <span className="ml-1.5 text-xs opacity-60">
                {PROJECT_TEMPLATES.filter((t) => t.category === cat).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Count */}
      <p className="text-xs text-muted-foreground mb-4">
        {filtered.length} template{filtered.length !== 1 ? 's' : ''}
        {activeCategory !== 'All' ? ` in ${activeCategory}` : ''}
        {search ? ` matching "${search}"` : ''}
      </p>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <p className="text-4xl mb-3">🔍</p>
          <p className="font-medium">No templates found</p>
          <p className="text-sm mt-1">Try a different search or category</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((template) => {
            const isLaunching = launchingId === template.title
            return (
              <div
                key={template.title}
                className="group relative flex flex-col border rounded-xl p-5 bg-background hover:border-primary/50 hover:shadow-sm transition-all"
              >
                {/* Emoji + category */}
                <div className="flex items-start justify-between mb-3">
                  <span className="text-3xl">{template.emoji}</span>
                  <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                    {template.category}
                  </span>
                </div>

                {/* Title + description */}
                <h3 className="font-semibold mb-1">{template.title}</h3>
                <p className="text-sm text-muted-foreground flex-1 mb-4 leading-relaxed">
                  {template.description}
                </p>

                {/* Use button */}
                <button
                  onClick={() => handleUse(template)}
                  disabled={!!launchingId}
                  className={cn(
                    'flex items-center justify-center gap-2 w-full py-2 rounded-lg text-sm font-medium transition-colors',
                    isLaunching
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground group-hover:bg-primary group-hover:text-primary-foreground',
                    launchingId && !isLaunching && 'opacity-50 cursor-not-allowed',
                  )}
                >
                  {isLaunching ? (
                    <><Loader2Icon className="size-4 animate-spin" /> Launching...</>
                  ) : (
                    'Use template →'
                  )}
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
