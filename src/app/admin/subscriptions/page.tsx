'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Loader2, Search, Settings, Tag, Wallet } from 'lucide-react'

/**
 * Platform admin: the daily revenue view.
 *
 * Shows the EFFECTIVE subscription state (computed against today) rather than
 * the stored status, which can lag until something touches the row.
 */

interface Row {
  orgId: string
  name: string
  city: string | null
  isDemo: boolean
  orgStatus: string
  referralSource: string | null
  shops: number
  users: number
  pendingClaims: number
  planCode: string | null
  planName: string | null
  status: string
  canWrite: boolean
  daysLeft: number | null
  deadline: string | null
  inTrial: boolean
  agreedMonthlyPrice: number | null
  priceNote: string | null
  cycle: string | null
  isComplimentary: boolean
  neverExpires: boolean
}

const STATUS_STYLES: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-800',
  TRIALING: 'bg-blue-100 text-blue-800',
  PAST_DUE: 'bg-amber-100 text-amber-800',
  EXPIRED: 'bg-red-100 text-red-800',
  CANCELLED: 'bg-gray-200 text-gray-700',
}

const CYCLES = ['MONTHLY', 'QUARTERLY', 'HALF_YEARLY', 'YEARLY']
const METHODS = ['RAAST', 'BANK_TRANSFER', 'JAZZCASH', 'EASYPAISA', 'CASH', 'OTHER']

function rs(n: number | null) {
  if (n === null) return '-'
  return `Rs ${Math.round(n).toLocaleString('en-PK')}`
}

export default function AdminSubscriptionsPage() {
  const [rows, setRows] = useState<Row[]>([])
  const [summary, setSummary] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState('')

  // Record payment modal
  const [payOrg, setPayOrg] = useState<Row | null>(null)
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState('RAAST')
  const [cycle, setCycle] = useState('MONTHLY')
  const [reference, setReference] = useState('')
  const [saving, setSaving] = useState(false)

  // Plan / price modal
  const [planOrg, setPlanOrg] = useState<Row | null>(null)
  const [planCode, setPlanCode] = useState('SOLO')
  const [customPrice, setCustomPrice] = useState('')
  const [priceNote, setPriceNote] = useState('')

  useEffect(() => {
    load()
  }, [filter])

  async function load() {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/subscriptions${filter ? `?filter=${filter}` : ''}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to load')
      setRows(json.rows)
      setSummary(json.summary)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function submitPayment() {
    if (!payOrg) return
    setSaving(true)
    setError('')
    try {
      const res = await fetch(`/api/admin/subscriptions/${payOrg.orgId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'recordPayment', amount: Number(amount), method, cycle, reference }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed')
      setPayOrg(null)
      setReference('')
      await load()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  async function submitPlan() {
    if (!planOrg) return
    setSaving(true)
    setError('')
    try {
      const res = await fetch(`/api/admin/subscriptions/${planOrg.orgId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'changePlan',
          planCode,
          agreedMonthlyPrice: customPrice === '' ? null : Number(customPrice),
          priceNote: priceNote || null,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed')
      setPlanOrg(null)
      setCustomPrice('')
      setPriceNote('')
      await load()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const visible = rows.filter(
    (r) => !q || r.name.toLowerCase().includes(q.toLowerCase()) || (r.city ?? '').toLowerCase().includes(q.toLowerCase())
  )

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Subscriptions</h1>
          <p className="text-sm text-gray-600">Who is paying, who is on trial, and who is about to lapse.</p>
        </div>
        <Link
          href="/admin/billing-settings"
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <Settings className="h-4 w-4" /> Prices and payment details
        </Link>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}

      {summary && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
          {[
            ['Monthly recurring', rs(summary.monthlyRecurring), 'text-green-700'],
            ['Active', summary.active, ''],
            ['On trial', summary.trialing, ''],
            ['Past due', summary.pastDue, 'text-amber-700'],
            ['Expired', summary.expired, 'text-red-700'],
            ['To verify', summary.pendingClaims, summary.pendingClaims > 0 ? 'text-blue-700' : ''],
          ].map(([label, value, tone]) => (
            <div key={label as string} className="rounded-xl border border-gray-200 bg-white p-3">
              <p className="text-xs uppercase tracking-wide text-gray-500">{label as string}</p>
              <p className={`mt-1 text-xl font-bold ${tone as string}`}>{value as any}</p>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name or city"
            className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm"
          />
        </div>
        {[
          ['', 'All'],
          ['expiring', 'Expiring soon'],
          ['unpaid', 'Needs attention'],
        ].map(([value, label]) => (
          <button
            key={label}
            onClick={() => setFilter(value)}
            className={`rounded-lg px-3 py-2 text-sm font-medium ${
              filter === value ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-gray-500">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading...
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3">Business</th>
                <th className="px-4 py-3">Plan</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Price</th>
                <th className="px-4 py-3">Deadline</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {visible.map((r) => (
                <tr key={r.orgId} className={r.pendingClaims > 0 ? 'bg-blue-50/50' : undefined}>
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">
                      {r.name}
                      {r.isDemo && <span className="ml-2 text-xs text-gray-400">demo</span>}
                    </div>
                    <div className="text-xs text-gray-500">
                      {r.city || 'No city'} · {r.shops} shop{r.shops === 1 ? '' : 's'} · {r.users} user
                      {r.users === 1 ? '' : 's'}
                      {r.referralSource ? ` · via ${r.referralSource}` : ''}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-900">{r.planName ?? '-'}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[r.status] ?? ''}`}>
                      {r.status.replace('_', ' ')}
                    </span>
                    {r.pendingClaims > 0 && (
                      <span className="ml-1 rounded-full bg-blue-600 px-2 py-0.5 text-xs font-medium text-white">
                        {r.pendingClaims} to verify
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={r.isComplimentary ? 'font-medium text-green-700' : 'text-gray-900'}>
                      {r.isComplimentary ? 'Free' : rs(r.agreedMonthlyPrice)}
                    </span>
                    {r.priceNote && <div className="text-xs text-gray-500">{r.priceNote}</div>}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {r.neverExpires
                      ? 'Never'
                      : r.daysLeft === null
                        ? '-'
                        : r.daysLeft < 0
                          ? `${Math.abs(r.daysLeft)}d overdue`
                          : `${r.daysLeft}d`}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => {
                          setPayOrg(r)
                          setAmount(String(r.agreedMonthlyPrice ?? 0))
                          setCycle(r.cycle ?? 'MONTHLY')
                        }}
                        title="Record a payment"
                        className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                      >
                        <Wallet className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => {
                          setPlanOrg(r)
                          setPlanCode(r.planCode ?? 'SOLO')
                          setCustomPrice(r.agreedMonthlyPrice === null ? '' : String(r.agreedMonthlyPrice))
                          setPriceNote(r.priceNote ?? '')
                        }}
                        title="Change plan or price"
                        aria-label="Change plan or price"
                        className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                      >
                        <Tag className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {payOrg && (
        <Modal title={`Record payment from ${payOrg.name}`} onClose={() => setPayOrg(null)}>
          <div className="space-y-3">
            <Field label="Amount received">
              <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className={INPUT} />
            </Field>
            <Field label="Method">
              <select value={method} onChange={(e) => setMethod(e.target.value)} className={INPUT}>
                {METHODS.map((m) => (
                  <option key={m} value={m}>{m.replace('_', ' ')}</option>
                ))}
              </select>
            </Field>
            <Field label="Period bought">
              <select value={cycle} onChange={(e) => setCycle(e.target.value)} className={INPUT}>
                {CYCLES.map((c) => (
                  <option key={c} value={c}>{c.replace('_', ' ').toLowerCase()}</option>
                ))}
              </select>
            </Field>
            <Field label="Reference (optional)">
              <input value={reference} onChange={(e) => setReference(e.target.value)} className={INPUT} />
            </Field>
            <p className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600">
              The new period is added from whichever is later: their current end date, or today. Paying early never
              loses days.
            </p>
          </div>
          <ModalActions onCancel={() => setPayOrg(null)} onConfirm={submitPayment} saving={saving} confirmLabel="Record payment" />
        </Modal>
      )}

      {planOrg && (
        <Modal title={`Plan for ${planOrg.name}`} onClose={() => setPlanOrg(null)}>
          <div className="space-y-3">
            <Field label="Plan">
              <select value={planCode} onChange={(e) => setPlanCode(e.target.value)} className={INPUT}>
                <option value="SOLO">Solo</option>
                <option value="TEAM">Team</option>
                <option value="BUSINESS">Business</option>
              </select>
            </Field>
            <Field label="Agreed monthly price">
              <input
                type="number"
                value={customPrice}
                onChange={(e) => setCustomPrice(e.target.value)}
                placeholder="Leave blank to use the list price"
                className={INPUT}
              />
            </Field>
            <Field label="Why this price">
              <input
                value={priceNote}
                onChange={(e) => setPriceNote(e.target.value)}
                placeholder="e.g. friend of Hamza, free"
                className={INPUT}
              />
            </Field>
            <p className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600">
              Set 0 for a free account. This price is theirs from now on, so a future price rise will not touch them.
              Write down why, or nobody will remember in a year.
            </p>
          </div>
          <ModalActions onCancel={() => setPlanOrg(null)} onConfirm={submitPlan} saving={saving} confirmLabel="Save plan" />
        </Modal>
      )}
    </div>
  )
}

const INPUT = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-gray-700">{label}</label>
      {children}
    </div>
  )
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
        <h3 className="mb-4 text-lg font-semibold text-gray-900">{title}</h3>
        {children}
      </div>
    </div>
  )
}

function ModalActions({
  onCancel, onConfirm, saving, confirmLabel,
}: { onCancel: () => void; onConfirm: () => void; saving: boolean; confirmLabel: string }) {
  return (
    <div className="mt-5 flex gap-2">
      <button onClick={onCancel} className="flex-1 rounded-lg bg-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-300">
        Cancel
      </button>
      <button
        onClick={onConfirm}
        disabled={saving}
        className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {saving ? 'Saving...' : confirmLabel}
      </button>
    </div>
  )
}
