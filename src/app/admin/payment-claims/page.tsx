'use client'

import { useEffect, useState } from 'react'
import { Check, Image as ImageIcon, Loader2, X } from 'lucide-react'

/**
 * Platform admin: the payment verification queue.
 *
 * Verify is one click and does everything: creates the payment, extends the
 * subscription, sets it ACTIVE, and purges the receipt image. Reject demands a
 * reason, because a rejection with no explanation guarantees a phone call.
 */

interface Claim {
  id: string
  organizationId: string
  amount: number
  method: string
  cycle: string
  reference: string | null
  note: string | null
  paidOn: string
  status: 'PENDING' | 'VERIFIED' | 'REJECTED'
  rejectReason: string | null
  createdAt: string
  hasReceipt: boolean
  agreedMonthlyPrice: number | null
  organization: {
    name: string
    city: string | null
    subscription: { currentPeriodEnd: string | null; plan: { code: string; name: string } | null } | null
  }
}

function rs(n: number) {
  return `Rs ${Math.round(n).toLocaleString('en-PK')}`
}

export default function PaymentClaimsPage() {
  const [claims, setClaims] = useState<Claim[]>([])
  const [status, setStatus] = useState('PENDING')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [receipt, setReceipt] = useState<{ id: string; src: string } | null>(null)
  const [rejecting, setRejecting] = useState<Claim | null>(null)
  const [reason, setReason] = useState('')

  useEffect(() => {
    load()
  }, [status])

  async function load() {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/payment-claims?status=${status}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to load')
      setClaims(json.claims)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function viewReceipt(claimId: string) {
    // Fetched one at a time: base64 images in a list payload would be enormous.
    const res = await fetch(`/api/admin/payment-claims?claimId=${claimId}`)
    const json = await res.json()
    if (json.claim?.receiptImage) setReceipt({ id: claimId, src: json.claim.receiptImage })
  }

  async function act(claimId: string, action: 'verify' | 'reject', why?: string) {
    setBusy(claimId)
    setError('')
    try {
      const res = await fetch('/api/admin/payment-claims', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ claimId, action, reason: why }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed')
      setRejecting(null)
      setReason('')
      await load()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Payments to verify</h1>
        <p className="text-sm text-gray-600">
          Shops tell us when they have transferred. Confirm it against your bank, then verify.
        </p>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}

      <div className="flex gap-2">
        {['PENDING', 'VERIFIED', 'REJECTED', 'ALL'].map((s) => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={`rounded-lg px-3 py-2 text-sm font-medium ${
              status === s ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {s.charAt(0) + s.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-gray-500">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading...
        </div>
      ) : claims.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white py-16 text-center text-gray-500">
          Nothing here.
        </div>
      ) : (
        <div className="space-y-3">
          {claims.map((c) => (
            <div key={c.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-gray-900">{c.organization.name}</p>
                  <p className="text-sm text-gray-500">
                    {c.organization.city || 'No city'} · {c.organization.subscription?.plan?.name ?? 'No plan'}
                    {c.agreedMonthlyPrice !== null && ` at ${rs(c.agreedMonthlyPrice)}/mo`}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xl font-bold text-gray-900">{rs(c.amount)}</p>
                  <p className="text-sm text-gray-500">
                    {c.method.replace('_', ' ').toLowerCase()} · {c.cycle.replace('_', ' ').toLowerCase()}
                  </p>
                </div>
              </div>

              <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-4">
                <Detail label="Paid on" value={new Date(c.paidOn).toLocaleDateString()} />
                <Detail label="Reference" value={c.reference || '-'} />
                <Detail label="Told us" value={new Date(c.createdAt).toLocaleDateString()} />
                <Detail
                  label="Covers until"
                  value={
                    c.organization.subscription?.currentPeriodEnd
                      ? new Date(c.organization.subscription.currentPeriodEnd).toLocaleDateString()
                      : 'no expiry'
                  }
                />
              </dl>

              {c.note && <p className="mt-2 rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-600">{c.note}</p>}
              {c.rejectReason && (
                <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">Rejected: {c.rejectReason}</p>
              )}

              <div className="mt-3 flex flex-wrap gap-2 border-t border-gray-100 pt-3">
                {c.hasReceipt && (
                  <button
                    onClick={() => viewReceipt(c.id)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    <ImageIcon className="h-4 w-4" /> View receipt
                  </button>
                )}
                {c.status === 'PENDING' && (
                  <>
                    <button
                      onClick={() => act(c.id, 'verify')}
                      disabled={busy === c.id}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
                    >
                      <Check className="h-4 w-4" /> {busy === c.id ? 'Verifying...' : 'Verify and extend'}
                    </button>
                    <button
                      onClick={() => setRejecting(c)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-red-300 px-3 py-1.5 text-sm font-semibold text-red-700 hover:bg-red-50"
                    >
                      <X className="h-4 w-4" /> Reject
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {receipt && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setReceipt(null)}
        >
          <img src={receipt.src} alt="Payment receipt" className="max-h-[90vh] max-w-full rounded-lg" />
        </div>
      )}

      {rejecting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900">Reject this payment?</h3>
            <p className="mt-1 text-sm text-gray-600">
              {rejecting.organization.name} will see this reason on their billing page, so make it something they can
              act on.
            </p>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="e.g. We could not find this transfer. Please check the reference number."
              className="mt-3 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setRejecting(null)}
                className="flex-1 rounded-lg bg-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={() => act(rejecting.id, 'reject', reason)}
                disabled={!reason.trim() || busy === rejecting.id}
                className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                Reject
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-gray-400">{label}</dt>
      <dd className="text-gray-900">{value}</dd>
    </div>
  )
}
