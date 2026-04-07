import { CreditCardIcon } from 'lucide-react'
import { DocsCallout } from '@/components/docs/docs-callout'
import { CreditCalculator } from '@/components/docs/credit-calculator'

export default function BillingPage() {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <CreditCardIcon className="size-5 text-primary" />
          <h1 className="text-2xl font-bold">Billing & Credits</h1>
        </div>
        <p className="text-muted-foreground">How credits work, when they reset, and how to get more.</p>
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Plans</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { name: 'Free',  credits: 5,   reset: 'Daily top-up — never exceeds 5', price: '$0' },
            { name: 'Pro',   credits: 100, reset: 'Monthly from billing date', price: '$25/mo' },
            { name: 'Team',  credits: 300, reset: 'Monthly, shared across team', price: '$49/mo' },
          ].map((p) => (
            <div key={p.name} className="rounded-xl border border-border bg-card p-4 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">{p.name}</p>
                <p className="text-sm font-bold text-primary">{p.price}</p>
              </div>
              <p className="text-2xl font-bold">{p.credits} <span className="text-sm font-normal text-muted-foreground">credits</span></p>
              <p className="text-xs text-muted-foreground">{p.reset}</p>
            </div>
          ))}
        </div>
      </div>

      <DocsCallout type="info">
        Free plan credits top up <strong>every day at midnight UTC</strong>. If your balance is below 5, it gets topped up to 5. If you already have 5 unused credits, nothing changes — they never stack above 5.
      </DocsCallout>

      <CreditCalculator />

      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Referral bonus</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Share your referral link from the <strong>/usage</strong> page. When someone signs up using your link, you both get <strong>+5 bonus credits</strong> added on top of your regular balance. Referral credits don't reset — they stack.
        </p>
        <DocsCallout type="tip">
          Referral credits are additive and don't affect your monthly reset cycle. They stay in your balance until you use them.
        </DocsCallout>
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold">What happens at zero credits</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          When your credits run out you can still view all your projects, browse version history, and use <strong>Ask mode</strong> to chat without generating. Only <strong>Build mode</strong> (which creates or edits code) requires credits.
        </p>
        <DocsCallout type="warning">
          Free credits never stack above 5. The daily top-up only fills you back up to 5 — it won't add to existing credits. Pro and Team plans reset monthly.
        </DocsCallout>
      </div>
    </div>
  )
}
