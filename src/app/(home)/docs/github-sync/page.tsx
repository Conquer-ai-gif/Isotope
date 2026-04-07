import { GithubIcon } from 'lucide-react'
import { DocsCallout } from '@/components/docs/docs-callout'
import { DocsSteps } from '@/components/docs/docs-steps'
import { SyncFlowDiagram } from '@/components/docs/sync-flow-diagram'

export default function GitHubSyncPage() {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <GithubIcon className="size-5 text-primary" />
          <h1 className="text-2xl font-bold">GitHub Sync</h1>
        </div>
        <p className="text-muted-foreground">Keep your Isotope projects and GitHub repos in perfect sync — automatically.</p>
      </div>

      <SyncFlowDiagram />

      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Connecting a repo</h2>
        <DocsSteps steps={[
          { title: 'Enable GitHub OAuth in Clerk', description: 'Make sure you signed in or connected your GitHub account via Settings → Connected Accounts.' },
          { title: 'Open your project', description: 'Go to any project and click the GitHub button in the project header toolbar.' },
          { title: 'Choose a repo', description: 'Select an existing repo or create a new one. Isotope registers a webhook on the repo automatically.' },
          { title: 'Done', description: 'From now on every generation auto-pushes to the repo as a new commit. No manual action needed.' },
        ]} />
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Pulling commits back</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          If you push commits directly to GitHub — from your local machine or another tool — Isotope detects the push via webhook and pulls the changes back into your project automatically. Your version history will show the incoming commit as a new version.
        </p>
        <DocsCallout type="info">
          Pulling commits from GitHub does <strong>not</strong> cost credits — only AI generations do.
        </DocsCallout>
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Conflict resolution</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          If both Isotope and GitHub modify the same file at the same time, a conflict is flagged in your project. You'll see a diff view showing both versions — pick which one to keep or merge them manually.
        </p>
        <DocsCallout type="warning">
          Always generate in Isotope before pushing manually to GitHub to minimize conflicts.
        </DocsCallout>
      </div>
    </div>
  )
}
