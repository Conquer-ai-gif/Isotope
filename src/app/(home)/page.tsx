import { FigmaImportButton } from '@/components/figma-import'
import { ProjectForm } from '@/modules/home/ui/components/project-form'
import { ProjectsList } from '@/modules/home/ui/components/project-list'
import Image from 'next/image'
import Link from 'next/link'
import { SignedIn, SignedOut } from '@clerk/nextjs'
import {
  SparklesIcon, GithubIcon, RocketIcon, DatabaseIcon,
  FigmaIcon, GitBranchIcon, CheckIcon, ArrowRightIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

const FEATURES = [
  { icon: SparklesIcon,  title: 'AI generation',     desc: 'Describe anything — get a working Next.js app in seconds' },
  { icon: CheckIcon,     title: 'Plan-First mode',   desc: 'Approve a structured plan before any code is written' },
  { icon: GithubIcon,   title: 'GitHub sync',        desc: 'Auto-push every generation. Pull commits back in too' },
  { icon: RocketIcon,   title: 'Vercel deploy',      desc: 'Live URL updated automatically after every generation' },
  { icon: DatabaseIcon, title: 'Supabase database',  desc: 'Real database auto-provisioned per project (Pro)' },
  { icon: FigmaIcon,    title: 'Figma import',       desc: 'Paste a Figma URL and get matching code instantly (Pro)' },
  { icon: GitBranchIcon, title: 'Branch per build',  desc: 'Every generation creates its own Git branch. Merge or discard' },
]

const STATS = [
  { value: '< 60s',  label: 'Average generation time' },
  { value: '5',      label: 'Free credits every month' },
  { value: '100%',   label: 'Code you own' },
]

export default function Page() {
  return (
    <div className="flex flex-col max-w-5xl mx-auto w-full">

      {/* ── Hero ── */}
      <section className="space-y-6 py-[12vh] 2xl:py-40">
        <div className="flex flex-col items-center gap-4">
          <Image src="/logo.svg" alt="Luno" width={52} height={52} className="hidden md:block" />

          {/* Badge */}
          <div className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border border-primary/30 bg-primary/5 text-primary">
            <SparklesIcon className="size-3" />
            AI-powered app builder
          </div>

          <h1 className="text-3xl md:text-6xl font-bold text-center leading-tight">
            Build something with <span className="text-primary">Luno</span>
          </h1>
          <p className="text-base md:text-xl text-muted-foreground text-center max-w-xl">
            Describe what you want — get a working Next.js app in seconds.
            Live preview, GitHub sync, Vercel deploy, and more.
          </p>

          <SignedOut>
            <div className="flex gap-3 pt-2">
              <Button asChild size="lg" className="gap-2">
                <Link href="/sign-up">
                  Start building free
                  <ArrowRightIcon className="size-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/pricing">View pricing</Link>
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              5 free credits every month — no credit card required
            </p>
          </SignedOut>
        </div>

        {/* Prompt form — signed in users */}
        <SignedIn>
          <div className="max-w-3xl mx-auto w-full space-y-3">
            <ProjectForm />
            <div className="flex justify-center">
              <FigmaImportButton />
            </div>
          </div>
        </SignedIn>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 max-w-lg mx-auto pt-2">
          {STATS.map((s) => (
            <div key={s.label} className="flex flex-col items-center gap-1 text-center">
              <p className="text-2xl font-bold text-primary">{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Signed in: projects list ── */}
      <SignedIn>
        <ProjectsList />
      </SignedIn>

      {/* ── Signed out: features + CTA ── */}
      <SignedOut>
        {/* Features grid */}
        <section className="py-16 space-y-10">
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-bold">Everything you need to ship</h2>
            <p className="text-muted-foreground text-sm">From idea to deployed app — no setup, no configuration</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="rounded-xl border border-border bg-card p-5 space-y-3 hover:border-primary/30 transition-colors">
                <div className="size-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
                  <Icon className="size-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="py-16">
          <div className="rounded-2xl border border-primary/20 bg-primary/5 p-10 text-center space-y-4">
            <h2 className="text-2xl font-bold">Ready to build?</h2>
            <p className="text-muted-foreground text-sm max-w-md mx-auto">
              Join thousands of builders who ship apps in seconds.
              Free forever — upgrade when you need more.
            </p>
            <Button asChild size="lg" className="gap-2">
              <Link href="/sign-up">
                Start building free
                <ArrowRightIcon className="size-4" />
              </Link>
            </Button>
            <p className="text-xs text-muted-foreground">
              5 free credits/month · No credit card · Cancel anytime
            </p>
          </div>
        </section>
      </SignedOut>

    </div>
  )
}
