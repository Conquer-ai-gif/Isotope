'use client'

import Image from 'next/image'
import { PricingTable } from '@clerk/nextjs'
import { dark } from '@clerk/themes'
import { useCurrentTheme } from '@/hooks/use-current-theme'
import { getClerkAppearance } from '@/lib/clerk-appearance'
import { CheckIcon } from 'lucide-react'
import Link from 'next/link'

const PLANS = [
  {
    name: 'Free',
    price: '$0',
    period: '',
    credits: '5 credits',
    creditDetail: 'on signup, never expires',
    color: 'border-border',
    features: [
      'AI code generation',
      'Live preview',
      'GitHub sync',
      'Public sharing',
      'Version history',
      '"Built with Isotope" badge',
    ],
  },
  {
    name: 'Pro',
    price: '$25',
    period: '/month',
    credits: '100 credits',
    creditDetail: 'per month, reset on billing date',
    color: 'border-primary',
    badge: 'Most popular',
    features: [
      'Everything in Free',
      'Hide "Built with Isotope" badge',
      'Custom domain on deployments',
      'Supabase database per project',
      'Figma import',
      'Model choice (coming soon)',
    ],
  },
  {
    name: 'Team',
    price: '$49',
    period: '/month',
    credits: '300 credits',
    creditDetail: 'per month, shared across team',
    color: 'border-border',
    features: [
      'Everything in Pro',
      'Up to 5 workspace members',
      'Owner pays for all generations',
      'Shared project workspace',
      'Role-based access (Owner/Editor/Viewer)',
      'Priority support',
    ],
  },
]

export const PricingClient = () => {
  const theme = useCurrentTheme()
  const appearance = getClerkAppearance(theme)

  return (
    <div className="flex flex-col max-w-5xl mx-auto w-full px-4">
      <section className="space-y-10 pt-[10vh] pb-16">
        {/* Header */}
        <div className="flex flex-col items-center gap-3">
          <Image src="/logo.svg" alt="Isotope" width={48} height={48} className="hidden md:block" />
          <h1 className="text-3xl md:text-4xl font-bold text-center">Simple pricing</h1>
          <p className="text-muted-foreground text-center max-w-md">
            Start free. Upgrade when you need more. Cancel any time.
          </p>
        </div>

        {/* Plan cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {PLANS.map((plan) => (
            <div
              key={plan.name}
              className={`rounded-xl border-2 ${plan.color} bg-card p-6 flex flex-col gap-4 relative`}
            >
              {plan.badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="text-xs font-medium bg-primary text-primary-foreground px-3 py-1 rounded-full">
                    {plan.badge}
                  </span>
                </div>
              )}

              <div>
                <p className="text-sm font-medium text-muted-foreground">{plan.name}</p>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-3xl font-bold">{plan.price}</span>
                  {plan.period && <span className="text-muted-foreground text-sm">{plan.period}</span>}
                </div>
              </div>

              <div className="rounded-lg bg-primary/5 border border-primary/20 px-3 py-2">
                <p className="text-sm font-semibold text-primary">{plan.credits}</p>
                <p className="text-xs text-muted-foreground">{plan.creditDetail}</p>
              </div>

              <ul className="space-y-2 flex-1">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    <CheckIcon className="size-4 text-primary flex-shrink-0 mt-0.5" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Clerk PricingTable for actual checkout */}
        <div className="space-y-4">
          <p className="text-center text-sm text-muted-foreground">
            Click a plan below to subscribe
          </p>
          <PricingTable
            appearance={{
              ...appearance,
              elements: {
                ...appearance.elements,
                pricingTableCard: 'border! shadow-none! rounded-xl!',
              },
            }}
          />
        </div>

        {/* FAQ */}
        <div className="max-w-2xl mx-auto space-y-4">
          <h2 className="text-lg font-semibold text-center">Common questions</h2>
          {[
            {
              q: 'What happens when I run out of credits?',
              a: 'You can still view your projects, chat in Ask mode, and browse your history. Only code generation (Build mode) requires credits.',
            },
            {
              q: 'Do unused credits roll over?',
              a: 'No — credits reset on your monthly billing date. Build more to make the most of them.',
            },
            {
              q: 'How does the Team plan work?',
              a: 'The workspace owner pays for the plan. Team members (Editors) can generate code and it charges from the owner\'s 300 monthly credits. Viewers can browse projects for free.',
            },
            {
              q: 'Can I get extra credits without upgrading?',
              a: 'Yes — share your referral link and you both get 5 bonus credits when someone signs up.',
            },
          ].map((item) => (
            <div key={item.q} className="rounded-xl border bg-card p-4">
              <p className="font-medium text-sm">{item.q}</p>
              <p className="text-sm text-muted-foreground mt-1.5">{item.a}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}