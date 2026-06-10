import Link from 'next/link'
import { ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react'
import { formatCurrency } from '@/lib/utils/money'
import type { LucideIcon } from 'lucide-react'

const GRADIENTS: Record<string, string> = {
  blue: 'from-blue-500 to-blue-600',
  emerald: 'from-emerald-500 to-emerald-600',
  violet: 'from-violet-500 to-violet-600',
  amber: 'from-amber-500 to-orange-500',
  rose: 'from-rose-500 to-rose-600',
  slate: 'from-slate-600 to-slate-700',
}

/** Percentage-change chip vs a previous value. `onColor` styles it for a colored tile. */
export function DeltaChip({
  current,
  previous,
  goodWhenUp = true,
  onColor = false,
}: {
  current: number
  previous: number
  goodWhenUp?: boolean
  onColor?: boolean
}) {
  const flat = current === previous
  const isNew = previous === 0 && current > 0
  const pct = previous === 0 ? 100 : Math.round(((current - previous) / Math.abs(previous)) * 100)
  const up = current >= previous
  const good = up === goodWhenUp
  const Icon = flat ? Minus : up ? ArrowUpRight : ArrowDownRight

  if (previous === 0 && current === 0) {
    return <span className={`text-xs ${onColor ? 'text-white/75' : 'text-[hsl(var(--muted-foreground))]'}`}>no change</span>
  }

  const color = onColor
    ? 'bg-white/20 text-white'
    : flat
      ? 'bg-slate-100 text-slate-500'
      : good
        ? 'bg-emerald-50 text-emerald-700'
        : 'bg-rose-50 text-rose-700'

  return (
    <span className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs font-semibold ${color}`}>
      <Icon className="h-3 w-3" />
      {isNew ? 'new' : `${Math.abs(pct)}%`}
    </span>
  )
}

/** Vibrant gradient KPI tile. */
export function StatCard({
  label,
  value,
  icon: Icon,
  accent = 'blue',
  delta,
  hint,
}: {
  label: string
  value: string
  icon: LucideIcon
  accent?: keyof typeof GRADIENTS
  delta?: React.ReactNode
  hint?: string
}) {
  const g = GRADIENTS[accent] || GRADIENTS.blue
  return (
    <div className={`rounded-xl bg-gradient-to-br ${g} p-4 text-white shadow-sm`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/20">
          <Icon className="h-5 w-5 text-white" />
        </div>
        {delta}
      </div>
      <div className="mt-3 text-sm font-medium text-white/85">{label}</div>
      <div className="text-2xl font-bold tracking-tight">{value}</div>
      {hint && <div className="mt-0.5 text-xs text-white/75">{hint}</div>}
    </div>
  )
}

export function SectionCard({
  title,
  action,
  children,
}: {
  title: string
  action?: { label: string; href: string }
  children: React.ReactNode
}) {
  return (
    <div className="rounded-xl border border-[hsl(var(--border))] bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-semibold">{title}</h2>
        {action && (
          <Link href={action.href} className="text-sm font-medium text-blue-600 hover:underline">
            {action.label} →
          </Link>
        )}
      </div>
      {children}
    </div>
  )
}

/** Smooth filled area chart for the 7-day sales trend (pure SVG, no library). */
export function AreaTrend({ data }: { data: Array<{ ymd: string; sales: number }> }) {
  const W = 300
  const H = 90
  const pad = 8
  const max = Math.max(1, ...data.map((d) => d.sales))
  const n = data.length
  const pts = data.map((d, i) => {
    const x = n === 1 ? W / 2 : (i / (n - 1)) * W
    const y = H - pad - (d.sales / max) * (H - pad * 2)
    return [x, y] as const
  })
  const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ')
  const area = `${line} L ${W} ${H} L 0 ${H} Z`

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="w-full" style={{ height: 120 }}>
        <defs>
          <linearGradient id="dashAreaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgb(59 130 246)" stopOpacity="0.35" />
            <stop offset="100%" stopColor="rgb(59 130 246)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#dashAreaGrad)" />
        <path
          d={line}
          fill="none"
          stroke="rgb(37 99 235)"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <div className="mt-1 flex justify-between">
        {data.map((d) => (
          <span key={d.ymd} className="flex-1 text-center text-[10px] text-[hsl(var(--muted-foreground))]">
            {new Date(d.ymd + 'T00:00:00Z').toLocaleDateString('en-US', { weekday: 'short' })}
          </span>
        ))}
      </div>
    </div>
  )
}

export function QuickAction({
  href,
  label,
  icon: Icon,
  primary = false,
}: {
  href: string
  label: string
  icon: LucideIcon
  primary?: boolean
}) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-3 rounded-xl border p-4 transition-colors ${
        primary
          ? 'border-blue-600 bg-blue-600 text-white hover:bg-blue-700'
          : 'border-[hsl(var(--border))] bg-white hover:bg-[hsl(var(--muted))]'
      }`}
    >
      <Icon className="h-5 w-5 shrink-0" />
      <span className="font-semibold">{label}</span>
    </Link>
  )
}

export function RecentSalesList({
  sales,
}: {
  sales: Array<{ id: string; createdAt: string; total: number; paymentStatus: string; customerName: string | null }>
}) {
  if (sales.length === 0) {
    return <div className="text-sm text-[hsl(var(--muted-foreground))]">No sales yet.</div>
  }
  return (
    <ul className="divide-y divide-[hsl(var(--border))]">
      {sales.map((s) => (
        <li key={s.id} className="flex items-center justify-between py-2 text-sm">
          <div className="min-w-0">
            <div className="truncate font-medium">{s.customerName || 'Walk-in'}</div>
            <div className="text-xs text-[hsl(var(--muted-foreground))]">
              {new Date(s.createdAt).toLocaleString()}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                s.paymentStatus === 'UDHAAR' ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'
              }`}
            >
              {s.paymentStatus === 'UDHAAR' ? 'Udhaar' : 'Paid'}
            </span>
            <span className="font-semibold">{formatCurrency(s.total)}</span>
          </div>
        </li>
      ))}
    </ul>
  )
}
