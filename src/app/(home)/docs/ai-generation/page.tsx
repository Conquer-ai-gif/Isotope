'use client'

import { useState } from 'react'
import { DocsCallout } from '@/components/docs/docs-callout'
import { DocsSteps } from '@/components/docs/docs-steps'
import { SparklesIcon, ArrowUpIcon } from 'lucide-react'

const EXAMPLES = [
  { label: '🛒 E-commerce', prompt: 'Build an e-commerce store with product listings, cart, and checkout using Stripe' },
  { label: '📊 Dashboard',  prompt: 'Create an analytics dashboard with charts, KPI cards, and a data table' },
  { label: '💬 Chat app',   prompt: 'Build a real-time chat app with rooms, user avatars, and message history' },
  { label: '🔐 Auth app',   prompt: 'Create an app with sign up, sign in, password reset, and a protected dashboard' },
]

export default function AiGenerationPage() {
  const [prompt, setPrompt] = useState('')

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <SparklesIcon className="size-5 text-primary" />
          <h1 className="text-2xl font-bold">How AI Generation Works</h1>
        </div>
        <p className="text-muted-foreground">Understand how Isotope turns your descriptions into working Next.js apps.</p>
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold">How it works</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          When you describe what you want to build, Isotope sends your prompt to an AI model that generates a complete Next.js application — including pages, components, API routes, and styling. The generated app is instantly compiled and served in a live preview inside your browser.
        </p>
        <DocsCallout type="info">
          Every generation costs <strong>1 credit</strong>. Follow-up prompts on the same project also cost 1 credit each.
        </DocsCallout>
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Try an example prompt</h2>
        <p className="text-sm text-muted-foreground">Click any example below to load it into the prompt box, then see how a good prompt is structured.</p>

        <div className="flex flex-wrap gap-2 mb-3">
          {EXAMPLES.map((e) => (
            <button
              key={e.label}
              onClick={() => setPrompt(e.prompt)}
              className="text-xs px-3 py-1.5 rounded-full border border-border hover:border-primary/50 text-muted-foreground hover:text-foreground transition-colors"
            >
              {e.label}
            </button>
          ))}
        </div>

        <div className="relative rounded-xl border border-border bg-card p-4">
          <textarea
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            rows={3}
            placeholder="Describe what you want to build..."
            className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none resize-none"
          />
          <div className="flex items-center justify-between mt-2">
            <span className="text-xs text-muted-foreground">This is a demo — go to the home page to actually generate</span>
            <div className="size-7 rounded-full bg-primary flex items-center justify-center">
              <ArrowUpIcon className="size-3.5 text-white" />
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Tips for better results</h2>
        <DocsSteps steps={[
          { title: 'Be specific about features', description: 'Instead of "make a website", try "build a portfolio site with a hero section, about page, project grid, and contact form".' },
          { title: 'Mention the tech you need', description: 'If you need Stripe payments, a database, or auth — say so explicitly. Isotope will wire it up.' },
          { title: 'Describe the design', description: 'Mention colors, layout style, or reference a design system. E.g. "use a dark theme with purple accents".' },
          { title: 'Iterate with follow-up prompts', description: 'You don\'t have to get it perfect in one go. Build the base, then refine with follow-up messages in the same project.' },
        ]} />
      </div>


      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Plan-First mode</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Before writing any code, Isotope generates a structured plan showing exactly what files will be created or modified, the technical approach, new dependencies, and an estimated time. You review the plan and either approve it to start generation or reject it to edit your prompt — no credit is consumed until you approve.
        </p>
        <DocsCallout type="tip">
          If you reject a plan your credit is automatically refunded. You only pay for generations you actually approve.
        </DocsCallout>
      </div>

      <DocsCallout type="tip">
        You can attach screenshots or mockups to your prompt using the image upload button. Isotope will use the image as visual reference when generating.
      </DocsCallout>
    </div>
  )
}
// Note: Plan-first mode section appended below
