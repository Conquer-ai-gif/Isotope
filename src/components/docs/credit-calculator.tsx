'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'

const PLANS = [
  { name: 'Free',  credits: 5,   color: 'border-border' },
  { name: 'Pro',   credits: 100, color: 'border-primary' },
  { name: 'Team',  credits: 300, color: 'border-violet-400' },
]

export function CreditCalculator() {
  const [plan, setPlan]   = useState(0)
  const [perDay, setPerDay] = useState(1)

  const credits   = PLANS[plan].credits
  const daysLeft  = Math.floor(credits / perDay)
  const pct       = Math.min(100, Math.round((daysLeft / 30) * 100))

  return (
    <div className="rounded-xl border border-border bg-card p-6 my-6 space-y-6">
      <p className="text-sm font-semibold text-foreground">Credit Calculator</p>

      {/* Plan selector */}
      <div className="flex gap-2">
        {PLANS.map((p, i) => (
          <button
            key={p.name}
            onClick={() => setPlan(i)}
            className={cn(
              'flex-1 py-2 rounded-lg border text-sm font-medium transition-colors',
              plan === i ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:border-primary/40',
            )}
          >
            {p.name}
          </button>
        ))}
      </div>

      {/* Generations per day slider */}
      <div className="space-y-2">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Generations per day</span>
          <span className="font-semibold text-foreground">{perDay}</span>
        </div>
        <input
          type="range" min={1} max={20} value={perDay}
          onChange={e => setPerDay(Number(e.target.value))}
          className="w-full accent-primary"
        />
      </div>

      {/* Result */}
      <div className="rounded-lg bg-muted/40 p-4 space-y-3">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Monthly credits</span>
          <span className="font-semibold text-foreground">{credits}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Credits per generation</span>
          <span className="font-semibold text-foreground">1</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Days credits last</span>
          <span className={cn('font-semibold', daysLeft >= 30 ? 'text-green-400' : daysLeft >= 14 ? 'text-amber-400' : 'text-red-400')}>
            {daysLeft >= 30 ? 'Full month ✓' : `${daysLeft} days`}
          </span>
        </div>
        {/* Progress bar */}
        <div className="w-full bg-muted rounded-full h-2">
          <div
            className={cn('h-2 rounded-full transition-all', pct >= 80 ? 'bg-green-500' : pct >= 40 ? 'bg-amber-500' : 'bg-red-500')}
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="text-xs text-muted-foreground text-center">
          {daysLeft >= 30
            ? 'Your credits will last the entire month 🎉'
            : `You'll run out of credits after ${daysLeft} days — consider upgrading`}
        </p>
      </div>
    </div>
  )
}
