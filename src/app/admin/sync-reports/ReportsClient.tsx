'use client'

import { useState } from 'react'

type Report = {
  id: string
  shopId: string | null
  orgId: string | null
  userId: string
  status: 'NEW' | 'REVIEWED'
  createdAt: string
  payload: any
}

export function ReportsClient({ initial }: { initial: Report[] }) {
  const [reports, setReports] = useState(initial)
  const [openId, setOpenId] = useState<string | null>(null)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [errorId, setErrorId] = useState<string | null>(null)

  async function markReviewed(id: string) {
    setPendingId(id)
    setErrorId(null)
    try {
      const res = await fetch(`/api/sync-error-reports/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'REVIEWED' }),
      })
      if (!res.ok) {
        // Surface the failure instead of silently doing nothing (e.g. expired session -> sign in again).
        setErrorId(id)
        return
      }
      setReports((rs) => rs.map((r) => (r.id === id ? { ...r, status: 'REVIEWED' } : r)))
    } catch {
      setErrorId(id)
    } finally {
      setPendingId(null)
    }
  }

  if (reports.length === 0) {
    return <p className="text-[hsl(var(--muted-foreground))]">No reports yet.</p>
  }

  return (
    <div className="space-y-2">
      {reports.map((r) => {
        const counts = r.payload?.counts || {}
        const total = Object.values(counts).reduce((s: number, n: any) => s + Number(n || 0), 0)
        const firstErr =
          Object.values(r.payload?.records || {})
            .flat()
            .map((x: any) => x?.syncError)
            .find(Boolean) || '(no stored error)'
        const stamp = r.payload?.serverStamp || {}
        const shopLabel = stamp.shopName || r.shopId || '-'
        const reportedBy = stamp.reportedBy || r.userId
        return (
          <div key={r.id} className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-3 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <span className="font-medium">{new Date(r.createdAt).toLocaleString()}</span>
                <span className="ml-2 text-[hsl(var(--muted-foreground))]">
                  {shopLabel} · by {reportedBy} · {total} pending · {String(firstErr)}
                </span>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {r.status === 'NEW' ? (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">NEW</span>
                ) : (
                  <span className="rounded-full bg-[hsl(var(--muted))] px-2 py-0.5 text-xs">reviewed</span>
                )}
                <button type="button" className="btn btn-ghost h-8 px-2 text-xs" onClick={() => setOpenId(openId === r.id ? null : r.id)}>
                  {openId === r.id ? 'Hide' : 'Details'}
                </button>
                {r.status === 'NEW' ? (
                  <button
                    type="button"
                    className="btn btn-ghost h-8 px-2 text-xs disabled:opacity-50"
                    disabled={pendingId === r.id}
                    onClick={() => void markReviewed(r.id)}
                  >
                    {pendingId === r.id ? 'Marking...' : 'Mark reviewed'}
                  </button>
                ) : null}
              </div>
            </div>
            {errorId === r.id ? (
              <p className="mt-1 text-xs text-red-600">Could not mark reviewed. Refresh and try again (you may need to sign in again).</p>
            ) : null}
            {openId === r.id ? (
              <pre className="mt-2 max-h-96 overflow-auto rounded bg-[hsl(var(--muted))] p-2 text-xs">
                {JSON.stringify(r.payload, null, 2)}
              </pre>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}
