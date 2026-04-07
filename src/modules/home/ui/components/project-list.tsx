'use client'
import Link from 'next/link'
import Image from 'next/image'
import { formatDistanceToNow } from 'date-fns'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'
import { Trash2Icon, GlobeIcon } from 'lucide-react'

import { useTRPC } from '@/trpc/client'
import { Button } from '@/components/ui/button'
import { useUser } from '@clerk/nextjs'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'

export const ProjectsList = () => {
  const trpc = useTRPC()
  const { user } = useUser()
  const queryClient = useQueryClient()
  const { data: projects } = useQuery(trpc.projects.getMany.queryOptions())
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const deleteProject = useMutation(trpc.projects.delete.mutationOptions({
    onSuccess: () => {
      queryClient.invalidateQueries(trpc.projects.getMany.queryOptions())
      toast.success('Project deleted')
      setDeletingId(null)
    },
    onError: (e) => toast.error(e.message),
  }))

  if (!user) return null

  return (
    <div className="w-full bg-white dark:bg-sidebar rounded-xl p-6 border flex flex-col gap-y-4">
      <h2 className="text-xl font-semibold">{user?.firstName}&apos;s Projects</h2>

      {(!projects || projects.length === 0) && (
        <p className="text-sm text-muted-foreground text-center py-8">No projects yet — build something above!</p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {projects?.map((project) => (
          <div key={project.id} className="group relative border rounded-lg hover:border-primary/50 transition-colors">
            <Link href={`/projects/${project.id}`} className="flex items-center gap-3 p-4">
              <Image src="/logo.svg" alt="Isotope" width={32} height={32} className="object-contain flex-shrink-0" />
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-1.5">
                  <h3 className="truncate font-medium text-sm">{project.name}</h3>
                  {project.isPublic && <GlobeIcon className="size-3 text-green-500 flex-shrink-0" />}
                </div>
                <p className="text-xs text-muted-foreground">
                  {formatDistanceToNow(project.updatedAt, { addSuffix: true })}
                </p>
              </div>
            </Link>

            {/* Delete button — shows on hover */}
            <button
              className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-md hover:bg-destructive/10 hover:text-destructive text-muted-foreground"
              onClick={(e) => { e.preventDefault(); setDeletingId(project.id) }}
              title="Delete project"
            >
              <Trash2Icon className="size-3.5" />
            </button>
          </div>
        ))}
      </div>

      {/* Delete confirm dialog */}
      <AlertDialog open={!!deletingId} onOpenChange={(o) => !o && setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete project?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the project and all its messages. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deletingId && deleteProject.mutate({ id: deletingId })}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
