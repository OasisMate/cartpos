'use client'

import { useEffect, useState } from 'react'
import {
  Building2, Check, Clock, Copy, Landmark, Loader2, Mail, MessageCircle, Upload,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { waUrl } from '@/lib/utils/whatsapp'
import { ModalShell } from '@/components/ui/ModalShell'

/**
 * The shop's billing page.
 *
 * Never gated by plan or expiry: a Solo owner has no /org surface and an
 * expired org is read-only, so if this page were behind either check they could
 * never see what they owe or tell us they paid.
 */

interface CycleOption {
  cycle: string
  label: string
  badge: string
  months: number
  total: number
  savings: number
}

interface Plan {
  id: string
  code: string
  name: string
  tagline: string | null
  monthlyPrice: number
  maxShops: number | null
  maxUsers: number | null
  maxCashiers: number | null
  extraShopPrice: number | null
  isPopular: boolean
  features: string[]
}

interface Claim {
  id: string
  amount: number
  method: string
  reference: string | null
  paidOn: string
  status: 'PENDING' | 'VERIFIED' | 'REJECTED'
  rejectReason: string | null
  createdAt: string
}

interface Payment {
  id: string
  amount: number
  method: string
  cycle: string
  periodEnd: string
  receivedAt: string
}

// Raast first: it is the method the page recommends, so it should be the
// default answer rather than something they hunt for below "Bank transfer".
const METHOD_LABELS: Record<string, string> = {
  RAAST: 'Raast (from my bank app)',
  BANK_TRANSFER: 'Bank transfer',
  JAZZCASH: 'JazzCash',
  EASYPAISA: 'Easypaisa',
  CASH: 'Cash',
  OTHER: 'Other',
}

function rs(n: number) {
  return `Rs ${Math.round(n).toLocaleString('en-PK')}`
}

export default function BillingPage() {
  const { user, refreshUser } = useAuth()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [cycle, setCycle] = useState('MONTHLY')

  // "I have paid" form
  const [showForm, setShowForm] = useState(false)
  const [amount, setAmount] = useState('')
  // Defaults to the method the page tells them to use.
  const [method, setMethod] = useState('RAAST')
  const [reference, setReference] = useState('')
  const [paidOn, setPaidOn] = useState(() => new Date().toISOString().slice(0, 10))
  const [receipt, setReceipt] = useState<File | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [copied, setCopied] = useState('')

  // Plan change: preview first, then they choose what stays active.
  const [impact, setImpact] = useState<any>(null)
  const [keepShops, setKeepShops] = useState<string[]>([])
  const [pickerError, setPickerError] = useState('')

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    try {
      const res = await fetch('/api/billing')
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to load billing')
      setData(json)
      if (json.subscription?.cycle) setCycle(json.subscription.cycle)
      const due = json.cycleOptions?.find((c: CycleOption) => c.cycle === (json.subscription?.cycle || 'MONTHLY'))
      if (due) setAmount(String(due.total))
    } catch (e: any) {
      setError(e.message || 'Failed to load')
    } finally {
      setLoading(false)
    }
  }

  async function submitClaim(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      const form = new FormData()
      form.append('amount', amount)
      form.append('method', method)
      form.append('cycle', cycle)
      form.append('reference', reference)
      form.append('paidOn', paidOn)
      if (receipt) form.append('receipt', receipt)

      const res = await fetch('/api/billing/claims', { method: 'POST', body: form })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Could not submit')
      setSubmitted(true)
      setShowForm(false)
      setReceipt(null)
      await load()
      await refreshUser()
    } catch (e: any) {
      setError(e.message || 'Could not submit')
    } finally {
      setSubmitting(false)
    }
  }

  /**
   * Show what choosing this plan would pause BEFORE anything happens.
   * They pick which shops survive; we never pick for them.
   */
  async function openPlanPicker(code: string) {
    setError('')
    setPickerError('')
    try {
      const res = await fetch(`/api/billing/plan?planCode=${code}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Could not check that plan')
      const im = json.impact
      setImpact(im)
      // Default to the busiest shops, which is almost always what they mean.
      const allowance = im.shopAllowance ?? im.activeShops.length
      setKeepShops(im.activeShops.slice(0, allowance).map((s: any) => s.id))
    } catch (e: any) {
      setError(e.message)
    }
  }

  async function confirmPlan() {
    if (!impact) return
    setSubmitting(true)
    setPickerError('')
    try {
      const res = await fetch('/api/billing/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'choosePlan', planCode: impact.planCode, keepShopIds: keepShops }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Could not change plan')
      setImpact(null)
      await load()
      await refreshUser()
    } catch (e: any) {
      setPickerError(e.message)
    } finally {
      setSubmitting(false)
    }
  }

  function copy(label: string, value: string) {
    navigator.clipboard?.writeText(value)
    setCopied(label)
    setTimeout(() => setCopied(''), 1500)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-500">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading billing...
      </div>
    )
  }

  if (!data) {
    return <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">{error}</div>
  }

  const { subscription, plans, settings, cycleOptions, payments, claims, shopCount } = data
  const billing = user?.billing
  const selected: CycleOption | undefined = cycleOptions.find((c: CycleOption) => c.cycle === cycle)
  const pendingClaim = claims?.find((c: Claim) => c.status === 'PENDING')
  const lastRejected = claims?.find((c: Claim) => c.status === 'REJECTED')
  const isFree = subscription && Number(subscription.agreedMonthlyPrice) === 0
  const neverExpires = subscription && subscription.currentPeriodEnd === null && subscription.status !== 'TRIALING'

  const waMessage = [
    `Cart POS payment`,
    `Business: ${user?.organizations?.[0]?.organization?.name ?? ''}`,
    `Amount: ${rs(Number(amount) || selected?.total || 0)}`,
    `Plan: ${subscription?.plan?.name ?? ''} (${METHOD_LABELS[method] ?? method})`,
  ].join('\n')

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Billing</h1>
        <p className="text-sm text-gray-600">Your plan, what you owe, and how to pay.</p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
      )}

      {submitted && !pendingClaim && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          Thank you. We will confirm your payment shortly.
        </div>
      )}

      {/* ---- Current plan ---- */}
      <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Current plan</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">
              {subscription?.plan?.name ?? 'No plan'}
            </p>
            <p className="text-sm text-gray-600">
              {isFree ? 'Free account' : `${rs(Number(subscription?.agreedMonthlyPrice ?? 0))} per month`}
              {shopCount > 1 && ` · ${shopCount} shops`}
            </p>
          </div>
          <div className="text-right">
            {neverExpires ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-800">
                <Check className="h-4 w-4" /> No expiry
              </span>
            ) : billing?.daysLeft !== null && billing?.daysLeft !== undefined ? (
              <>
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                  {billing.inTrial ? 'Trial ends' : 'Renews'}
                </p>
                <p
                  className={`mt-1 text-2xl font-bold ${
                    billing.daysLeft < 0 ? 'text-red-600' : billing.daysLeft <= 5 ? 'text-amber-600' : 'text-gray-900'
                  }`}
                >
                  {billing.daysLeft < 0
                    ? `${Math.abs(billing.daysLeft)} days overdue`
                    : `${billing.daysLeft} days left`}
                </p>
                {subscription?.trialEndsAt || subscription?.currentPeriodEnd ? (
                  <p className="text-sm text-gray-500">
                    {new Date(subscription.trialEndsAt || subscription.currentPeriodEnd).toLocaleDateString(
                      'en-GB',
                      { day: 'numeric', month: 'long', year: 'numeric' }
                    )}
                  </p>
                ) : null}
              </>
            ) : null}
          </div>
        </div>

        {isFree && (
          <p className="mt-4 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800">
            This account has no charge{subscription?.priceNote ? `: ${subscription.priceNote}` : '.'}
          </p>
        )}
      </section>

      {pendingClaim && (
        <section className="rounded-xl border border-blue-200 bg-blue-50 p-4">
          <div className="flex items-start gap-3">
            <Clock className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
            <div>
              <p className="font-semibold text-blue-900">
                We are checking your payment of {rs(pendingClaim.amount)}
              </p>
              <p className="text-sm text-blue-800">
                Sent {new Date(pendingClaim.createdAt).toLocaleDateString()} by{' '}
                {METHOD_LABELS[pendingClaim.method] ?? pendingClaim.method}
                {pendingClaim.reference ? ` · ref ${pendingClaim.reference}` : ''}. Your plan updates as soon as we confirm it.
              </p>
            </div>
          </div>
        </section>
      )}

      {lastRejected && !pendingClaim && (
        <section className="rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="font-semibold text-red-900">
            Your last payment of {rs(lastRejected.amount)} could not be confirmed
          </p>
          <p className="text-sm text-red-800">{lastRejected.rejectReason}</p>
        </section>
      )}

      {/* ---- Pay ---- */}
      {!isFree && !neverExpires && (
        <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">Pay for your plan</h2>
          <p className="mt-1 text-sm text-gray-600">Choose how long you want to pay for. Longer periods cost less.</p>

          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {cycleOptions.map((c: CycleOption) => (
              <button
                key={c.cycle}
                onClick={() => {
                  setCycle(c.cycle)
                  setAmount(String(c.total))
                }}
                className={`rounded-xl border-2 p-3 text-left transition-colors ${
                  cycle === c.cycle
                    ? 'border-blue-600 bg-blue-50'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <p className="text-sm font-semibold text-gray-900">{c.label}</p>
                <p className="text-lg font-bold text-gray-900">{rs(c.total)}</p>
                {c.badge && (
                  <p className="mt-1 inline-block rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-semibold text-green-800">
                    {c.badge}
                  </p>
                )}
              </button>
            ))}
          </div>

          {/* Where to send the money */}
          <div className="mt-6 rounded-xl border border-gray-200 bg-gray-50 p-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
              <Landmark className="h-4 w-4" /> Send {rs(selected?.total ?? 0)} to
            </h3>
            {settings.raastId && (
              <p className="mt-2 rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-800">
                Easiest way: open your bank app, choose Raast, and send to the Raast ID below.
                It arrives instantly and costs nothing.
              </p>
            )}
            <dl className="mt-3 space-y-2 text-sm">
              {[
                // Raast first: instant, free, and works from any bank app
                // without us publishing an account number.
                ['Raast ID', settings.raastId],
                ['Account title', settings.accountTitle],
                ['JazzCash', settings.jazzcashNumber],
                ['Easypaisa', settings.easypaisaNumber],
                ['Bank', settings.bankName],
                ['Account number', settings.accountNumber],
                ['IBAN', settings.iban],
              ]
                .filter(([, v]) => v)
                .map(([label, value]) => (
                  <div key={label as string} className="flex items-center justify-between gap-3">
                    <dt className="text-gray-600">{label}</dt>
                    <dd className="flex items-center gap-2 font-medium text-gray-900">
                      <span className="font-mono">{value as string}</span>
                      <button
                        onClick={() => copy(label as string, String(value))}
                        className="rounded p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-700"
                        title={`Copy ${label}`}
                      >
                        {copied === label ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
                      </button>
                    </dd>
                  </div>
                ))}
            </dl>
            {!settings.raastId && !settings.bankName && !settings.jazzcashNumber && !settings.easypaisaNumber && (
              <p className="text-sm text-gray-500">
                Payment details are not set up yet. Please contact us for how to pay.
              </p>
            )}
            {settings.instructions && (
              <p className="mt-3 border-t border-gray-200 pt-3 text-sm text-gray-600">{settings.instructions}</p>
            )}
          </div>

          {!pendingClaim && (
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                onClick={() => setShowForm(true)}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
              >
                I have paid
              </button>
              {settings.whatsappNumber && (
                <a
                  href={waUrl(settings.whatsappNumber, waMessage)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-lg border border-green-600 px-4 py-2 text-sm font-semibold text-green-700 hover:bg-green-50"
                >
                  <MessageCircle className="h-4 w-4" /> Send receipt on WhatsApp
                </a>
              )}
              {settings.supportEmail && (
                <a
                  href={`mailto:${settings.supportEmail}?subject=${encodeURIComponent('Cart POS payment')}&body=${encodeURIComponent(waMessage)}`}
                  className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                >
                  <Mail className="h-4 w-4" /> Email us
                </a>
              )}
            </div>
          )}
        </section>
      )}

      {/* ---- Plans ---- */}
      <section>
        <h2 className="mb-3 text-lg font-semibold text-gray-900">Plans</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {plans.map((p: Plan) => {
            const current = subscription?.plan?.code === p.code
            return (
              <div
                key={p.code}
                className={`relative rounded-xl border-2 bg-white p-5 shadow-sm ${
                  p.isPopular ? 'border-blue-600' : 'border-gray-200'
                }`}
              >
                {p.isPopular && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-blue-600 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-white">
                    Most popular
                  </span>
                )}
                <h3 className="text-lg font-bold text-gray-900">{p.name}</h3>
                <p className="text-sm text-gray-500">{p.tagline}</p>
                <p className="mt-3 text-2xl font-bold text-gray-900">
                  {rs(p.monthlyPrice)}
                  <span className="text-sm font-normal text-gray-500">/month</span>
                </p>
                <ul className="mt-4 space-y-1.5 text-sm text-gray-600">
                  <li>{p.maxUsers === null ? 'Unlimited users' : p.maxUsers === 1 ? 'Just you' : `Up to ${p.maxUsers} users`}</li>
                  <li>{p.maxShops === null ? 'Unlimited shops' : p.maxShops === 1 ? '1 shop' : `${p.maxShops} shops`}</li>
                  {p.extraShopPrice ? <li>Extra shop {rs(p.extraShopPrice)}/month</li> : null}
                </ul>
                {current ? (
                  <p className="mt-4 rounded-lg bg-gray-100 px-3 py-2 text-center text-sm font-semibold text-gray-700">
                    Your plan
                  </p>
                ) : (
                  <button
                    onClick={() => openPlanPicker(p.code)}
                    className="mt-4 w-full rounded-lg bg-gray-900 px-3 py-2 text-sm font-semibold text-white hover:bg-gray-800"
                  >
                    Choose {p.name}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </section>

      {/* ---- History ---- */}
      {payments.length > 0 && (
        <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-3 text-lg font-semibold text-gray-900">Payment history</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
                  <th className="pb-2">Date</th>
                  <th className="pb-2">Amount</th>
                  <th className="pb-2">Method</th>
                  <th className="pb-2">Covers until</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {payments.map((p: Payment) => (
                  <tr key={p.id}>
                    <td className="py-2 text-gray-900">{new Date(p.receivedAt).toLocaleDateString()}</td>
                    <td className="py-2 font-medium text-gray-900">{rs(p.amount)}</td>
                    <td className="py-2 text-gray-600">{METHOD_LABELS[p.method] ?? p.method}</td>
                    <td className="py-2 text-gray-600">{new Date(p.periodEnd).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ---- Plan change: they choose what stays ---- */}
      {impact && (
        <ModalShell onClose={() => setImpact(null)} className="w-full max-w-lg">
            <h3 className="text-lg font-semibold text-gray-900">Move to {impact.planName}</h3>

            {!impact.mustChooseShops && impact.seatsToPause.length === 0 && !impact.losesOrgLevel ? (
              <p className="mt-2 text-sm text-gray-600">
                Everything you use fits on {impact.planName}. Nothing will change except the price.
              </p>
            ) : (
              <p className="mt-2 text-sm text-gray-600">
                {impact.planName} is smaller than what you use now. Nothing is deleted: anything paused comes
                straight back if you move up again.
              </p>
            )}

            {impact.mustChooseShops && (
              <div className="mt-4">
                <p className="mb-2 text-sm font-medium text-gray-900">
                  {impact.planName} covers {impact.shopAllowance} shop
                  {impact.shopAllowance === 1 ? '' : 's'}. Choose which stay open.
                </p>
                <div className="space-y-2">
                  {impact.activeShops.map((s: any) => {
                    const checked = keepShops.includes(s.id)
                    const full = keepShops.length >= (impact.shopAllowance ?? 99)
                    return (
                      <label
                        key={s.id}
                        className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 ${
                          checked ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                        } ${!checked && full ? 'opacity-50' : ''}`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={!checked && full}
                          onChange={(e) =>
                            setKeepShops((prev) =>
                              e.target.checked ? [...prev, s.id] : prev.filter((id) => id !== s.id)
                            )
                          }
                          className="h-4 w-4"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block font-medium text-gray-900">{s.name}</span>
                          <span className="block text-xs text-gray-500">
                            {s.city || 'No city'} · {s.invoices} sales
                          </span>
                        </span>
                      </label>
                    )
                  })}
                </div>
                <p className="mt-2 text-xs text-gray-500">
                  Shops you do not choose become read-only. Their sales, stock and customers stay exactly as they
                  are.
                </p>
              </div>
            )}

            {impact.seatsToPause.length > 0 && (
              <div className="mt-4 rounded-lg bg-amber-50 p-3">
                <p className="text-sm font-medium text-amber-900">
                  {impact.seatsToPause.length} staff account
                  {impact.seatsToPause.length === 1 ? '' : 's'} will be paused
                </p>
                <ul className="mt-1 text-xs text-amber-800">
                  {impact.seatsToPause.map((s: any) => (
                    <li key={s.userId}>
                      {s.name} ({s.email})
                    </li>
                  ))}
                </ul>
                <p className="mt-1 text-xs text-amber-700">Your own account is never affected.</p>
              </div>
            )}

            {impact.losesOrgLevel && (
              <p className="mt-3 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600">
                The organisation dashboard and activity log will be hidden on this plan. Your data stays.
              </p>
            )}

            {pickerError && (
              <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{pickerError}</p>
            )}

            <div className="mt-5 flex gap-2">
              <button
                onClick={() => setImpact(null)}
                className="flex-1 rounded-lg bg-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={confirmPlan}
                disabled={submitting || (impact.mustChooseShops && keepShops.length === 0)}
                className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {submitting ? 'Saving...' : `Move to ${impact.planName}`}
              </button>
            </div>
        </ModalShell>
      )}

      {/* ---- I have paid ---- */}
      {showForm && (
        <ModalShell onClose={() => setShowForm(false)}>
          <form onSubmit={submitClaim}>
            <h3 className="text-lg font-semibold text-gray-900">Tell us about your payment</h3>
            <p className="mt-1 text-sm text-gray-600">
              We will check it and update your plan. You can also send the screenshot on WhatsApp.
            </p>

            <div className="mt-4 space-y-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Amount paid</label>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                  min={1}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">How did you pay?</label>
                <select
                  value={method}
                  onChange={(e) => setMethod(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
                >
                  {Object.entries(METHOD_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Date paid</label>
                <input
                  type="date"
                  value={paidOn}
                  onChange={(e) => setPaidOn(e.target.value)}
                  required
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Transaction ID or reference (optional)
                </label>
                <input
                  type="text"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder="e.g. TID 884213"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Receipt screenshot (optional)</label>
                <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-gray-300 px-3 py-2.5 text-sm text-gray-600 hover:bg-gray-50">
                  <Upload className="h-4 w-4" />
                  {receipt ? receipt.name : 'Choose an image (max 2MB)'}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={(e) => setReceipt(e.target.files?.[0] ?? null)}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="flex-1 rounded-lg bg-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {submitting ? 'Sending...' : 'Send'}
              </button>
            </div>
          </form>
        </ModalShell>
      )}
    </div>
  )
}
