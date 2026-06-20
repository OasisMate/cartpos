'use client'

import { useState } from 'react'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Modal from '@/components/ui/Modal'
import { useToast } from '@/components/ui/ToastProvider'
import { formatCurrency } from '@/lib/utils/money'

export interface DrawerRow {
  id: string
  label: string | null
  status: 'OPEN' | 'CLOSED'
  openedByName: string
  openingFloat: number
  openedAt: string
  closedByName: string | null
  closedAt: string | null
  countedCash: number | null
  expectedCash: number | null
  variance: number | null
}

function VarianceBadge({ v }: { v: number | null }) {
  if (v == null) return <span className="text-[hsl(var(--muted-foreground))]">—</span>
  if (Math.abs(v) < 0.01) return <span className="text-green-700 font-medium">Match</span>
  return (
    <span className={v > 0 ? 'text-blue-700 font-medium' : 'text-red-700 font-medium'}>
      {v > 0 ? `Over ${formatCurrency(v)}` : `Short ${formatCurrency(Math.abs(v))}`}
    </span>
  )
}

export default function DrawersClient({ initial }: { initial: DrawerRow[] }) {
  const { show } = useToast()
  const [rows, setRows] = useState<DrawerRow[]>(initial)
  const [closing, setClosing] = useState<DrawerRow | null>(null)
  const [counted, setCounted] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  async function forceClose() {
    if (!closing) return
    const count = parseFloat(counted)
    if (!Number.isFinite(count) || count < 0) {
      show({ message: 'Enter the counted cash', variant: 'destructive' })
      return
    }
    setBusy(true)
    try {
      const res = await fetch(`/api/shifts/${closing.id}/close`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ countedCash: count, note: note.trim() || undefined }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to close drawer')
      const s = data.shift
      setRows((prev) =>
        prev.map((r) =>
          r.id === closing.id
            ? { ...r, status: 'CLOSED', closedAt: s.closedAt, countedCash: Number(s.countedCash), expectedCash: Number(s.expectedCash), variance: Number(s.variance), closedByName: 'You' }
            : r,
        ),
      )
      setClosing(null)
      setCounted('')
      setNote('')
      show({ message: 'Drawer closed', variant: 'success' })
    } catch (err: any) {
      show({ message: err.message || 'Failed to close drawer', variant: 'destructive' })
    } finally {
      setBusy(false)
    }
  }

  const expectedDiff = closing?.expectedCash != null ? parseFloat(counted || '0') - closing.expectedCash : 0

  return (
    <>
      <div className="overflow-x-auto rounded-lg border border-[hsl(var(--border))]">
        <table className="w-full text-sm">
          <thead className="bg-[hsl(var(--muted))] text-left">
            <tr>
              <th className="px-3 py-2">Cashier</th>
              <th className="px-3 py-2">Drawer</th>
              <th className="px-3 py-2">Opened</th>
              <th className="px-3 py-2 text-right">Float</th>
              <th className="px-3 py-2 text-right">Expected</th>
              <th className="px-3 py-2 text-right">Counted</th>
              <th className="px-3 py-2">Variance</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={9} className="px-3 py-6 text-center text-[hsl(var(--muted-foreground))]">No drawers yet.</td></tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="border-t border-[hsl(var(--border))]">
                  <td className="px-3 py-2">{r.openedByName}</td>
                  <td className="px-3 py-2">{r.label || '—'}</td>
                  <td className="px-3 py-2">{new Date(r.openedAt).toLocaleString()}</td>
                  <td className="px-3 py-2 text-right">{formatCurrency(r.openingFloat)}</td>
                  <td className="px-3 py-2 text-right">{r.expectedCash != null ? formatCurrency(r.expectedCash) : '—'}</td>
                  <td className="px-3 py-2 text-right">{r.countedCash != null ? formatCurrency(r.countedCash) : '—'}</td>
                  <td className="px-3 py-2"><VarianceBadge v={r.variance} /></td>
                  <td className="px-3 py-2">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${r.status === 'OPEN' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                      {r.status === 'OPEN' ? 'Open' : 'Closed'}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    {r.status === 'OPEN' && (
                      <Button variant="outline" className="h-8 px-3" onClick={() => setClosing(r)}>Close</Button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Modal open={!!closing} onClose={() => setClosing(null)} title="Close drawer (manager)" size="sm">
        {closing && (
          <div className="space-y-3">
            <p className="text-sm text-[hsl(var(--muted-foreground))]">
              Closing the drawer for {closing.openedByName}{closing.label ? ` (${closing.label})` : ''}. Expected cash:{' '}
              <span className="font-semibold text-[hsl(var(--foreground))]">{closing.expectedCash != null ? formatCurrency(closing.expectedCash) : '—'}</span>
            </p>
            <label className="block text-sm">
              <span className="mb-1 block text-[hsl(var(--muted-foreground))]">Counted cash</span>
              <Input type="number" inputMode="decimal" value={counted} onChange={(e) => setCounted(e.target.value)} autoFocus />
            </label>
            {counted !== '' && closing.expectedCash != null && (
              <div className={`text-sm font-medium ${Math.abs(expectedDiff) < 0.01 ? 'text-green-700' : expectedDiff > 0 ? 'text-blue-700' : 'text-red-700'}`}>
                {Math.abs(expectedDiff) < 0.01 ? 'Matches expected.' : expectedDiff > 0 ? `Over by ${formatCurrency(expectedDiff)}` : `Short by ${formatCurrency(Math.abs(expectedDiff))}`}
              </div>
            )}
            <label className="block text-sm">
              <span className="mb-1 block text-[hsl(var(--muted-foreground))]">Note (optional)</span>
              <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Reason / handover note" />
            </label>
            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1" onClick={() => setClosing(null)} disabled={busy}>Cancel</Button>
              <Button variant="danger" className="flex-1" onClick={forceClose} disabled={busy}>{busy ? 'Closing...' : 'Close Drawer'}</Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  )
}
