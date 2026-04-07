'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { FigmaIcon, Loader2Icon, XIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'

export const FigmaImportButton = () => {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [preview, setPreview] = useState<{ name: string } | null>(null)

  const handleImport = async () => {
    if (!url.trim()) return
    setLoading(true)

    try {
      const res = await fetch('/api/figma', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ figmaUrl: url.trim() }),
      })

      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error ?? 'Import failed')
        return
      }

      toast.success(`Importing "${data.pageName}"...`)
      setOpen(false)
      setUrl('')
      router.push(`/projects/${data.projectId}`)
    } catch {
      toast.error('Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  const isValidUrl = url.includes('figma.com/file/') || url.includes('figma.com/design/')

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <FigmaIcon className="size-4" />
          Import from Figma
        </Button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Import a Figma design</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Paste a Figma file or frame URL. Isotope will read the design and generate matching Next.js code.
          </p>

          <div className="space-y-1.5">
            <Input
              placeholder="https://www.figma.com/file/..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && isValidUrl && handleImport()}
              className="font-mono text-xs"
            />
            {url && !isValidUrl && (
              <p className="text-xs text-destructive">
                Must be a figma.com/file/ or figma.com/design/ URL
              </p>
            )}
          </div>

          {/* How to get a Figma URL hint */}
          <div className="rounded-lg bg-muted/50 p-3 space-y-1.5 text-xs text-muted-foreground">
            <p className="font-medium text-foreground">How to get the URL:</p>
            <p>1. Open your file in Figma</p>
            <p>2. Right-click a frame → Copy link</p>
            <p>3. Or just copy the URL from your browser</p>
            <p className="text-[11px] mt-2">
              Make sure the file is set to <span className="font-medium">Anyone with the link can view</span> — or use a personal access token with access to private files.
            </p>
          </div>

          <Button
            className="w-full"
            disabled={!isValidUrl || loading}
            onClick={handleImport}
          >
            {loading
              ? <><Loader2Icon className="size-4 animate-spin" /> Importing design...</>
              : <><FigmaIcon className="size-4" /> Import & generate code</>
            }
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
