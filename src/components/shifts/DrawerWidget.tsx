'use client'

import { useCallback, useEffect, useState } from 'react'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Modal from '@/components/ui/Modal'
import { useToast } from '@/components/ui/ToastProvider'
import { formatCurrency } from '@/lib/utils/money'
import { Wallet, ArrowDownCircle } from 'lucide-react'

interface Breakdown {
  openingFloat: number
  cashIn: number
  refunds: number
  expenses: number
  supplierCash: number
  manualIn: number
  manualOut: number
  expected: number
}

interface CurrentShift {
  id: string
  label: string | null
  openingFloat: number
  openedAt: string
}

const MOVE_TYPES = [
  { type: 'PAY_IN', dir: 'IN', label: 'Add cash (pay-in)' },
  { type: 'FLOAT_ADD', dir: 'IN', label: 'Add change/float' },
  { type: 'PAY_OUT', dir: 'OUT', label: 'Petty cash out' },
  { type: 'BANK_DROP', dir: 'OUT', label: 'Bank drop' },
  { type: 'OWNER_DRAW', dir: 'OUT', label: 'Owner took cash' },
] as const

/**
 * Cashier-facing cash drawer control. Self-contained: fetches the caller's open drawer,
 * lets them open / close / record manual cash in-out, and shows live expected cash.
 * Reports open state up via onStateChange so the POS can gate sales when required.
 */
export default function DrawerWidget({ onStateChange }: { onStateChange?: (open: boolean) => void }) {
  const { show } = useToast()
  const [loading, setLoading] = useState(true)
  const [shift, setShift] = useState<CurrentShift | null>(null)
  const [breakdown, setBreakdown] = useState<Breakdown | null>(null)
  const [busy, setBusy] = useState(false)

  const [showOpen, setShowOpen] = useState(false)
  const [openFloat, setOpenFloat] = useState('')
  const [openLabel, setOpenLabel] = useState('')

  const [showClose, setShowClose] = useState(false)
  const [counted, setCounted] = useState('')
  const [closeNote, setCloseNote] = useState('')

  const [showMove, setShowMove] = useState(false)
  const [moveType, setMoveType] = useState<(typeof MOVE_TYPES)[number]['type']>('PAY_OUT')
  const [moveAmount, setMoveAmount] = useState('')
  const [moveReason, setMoveReason] = useState('')

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/shifts/current')
      if (!res.ok) return
      const data = await res.json()
      setShift(data.shift)
      setBreakdown(data.breakdown ?? null)
      onStateChange?.(!!data.shift)
    } catch {
      /* ignore */
    } finally {
      setLoading(false)
    }
  }, [onStateChange])

  useEffect(() => {
    load()
  }, [load])

  async function doOpen() {
    const float = parseFloat(openFloat)
    if (!Number.isFinite(float) || float < 0) {
      show({ message: 'Enter the opening cash (float)', variant: 'destructive' })
      return
    }
    setBusy(true)
    try {
      const res = await fetch('/api/shifts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ openingFloat: float, label: openLabel.trim() || undefined }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to open drawer')
      setShowOpen(false)
      setOpenFloat('')
      setOpenLabel('')
      show({ message: 'Drawer opened', variant: 'success' })
      await load()
    } catch (err: any) {
      show({ message: err.message || 'Failed to open drawer', variant: 'destructive' })
    } finally {
      setBusy(false)
    }
  }

  async function doClose() {
    const count = parseFloat(counted)
    if (!Number.isFinite(count) || count < 0) {
      show({ message: 'Enter the counted cash', variant: 'destructive' })
      return
    }
    setBusy(true)
    try {
      const res = await fetch(`/api/shifts/${shift!.id}/close`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ countedCash: count, note: closeNote.trim() || undefined }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to close drawer')
      const v = Number(data.shift.variance)
      setShowClose(false)
      setCounted('')
      setCloseNote('')
      show({
        message: v === 0 ? 'Drawer closed. Cash matches.' : `Drawer closed. ${v > 0 ? 'Over' : 'Short'} by ${formatCurrency(Math.abs(v))}.`,
        variant: v === 0 ? 'success' : 'warning',
      })
      await load()
    } catch (err: any) {
      show({ message: err.message || 'Failed to close drawer', variant: 'destructive' })
    } finally {
      setBusy(false)
    }
  }

  async function doMove() {
    const amt = parseFloat(moveAmount)
    if (!Number.isFinite(amt) || amt <= 0) {
      show({ message: 'Enter an amount greater than zero', variant: 'destructive' })
      return
    }
    setBusy(true)
    try {
      const res = await fetch(`/api/shifts/${shift!.id}/movement`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: moveType, amount: amt, reason: moveReason.trim() || undefined }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to record cash')
      setShowMove(false)
      setMoveAmount('')
      setMoveReason('')
      show({ message: 'Cash movement recorded', variant: 'success' })
      await load()
    } catch (err: any) {
      show({ message: err.message || 'Failed to record cash', variant: 'destructive' })
    } finally {
      setBusy(false)
    }
  }

  const expectedClose = breakdown ? parseFloat(counted || '0') - breakdown.expected : 0

  if (loading) return null

  return (
    <>
      {/* Trigger */}
      {shift ? (
        <button
          type="button"
          onClick={() => setShowClose(true)}
          className="inline-flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-1.5 text-sm font-medium text-green-800 hover:bg-green-100"
          title="Drawer is open . click to close"
        >
          <Wallet className="h-4 w-4" />
          <span>Drawer: {breakdown ? formatCurrency(breakdown.expected) : '—'}</span>
        </button>
      ) : (
        <Button variant="outline" className="h-9" onClick={() => setShowOpen(true)}>
          <Wallet className="h-4 w-4 mr-1.5" /> Open Drawer
        </Button>
      )}

      {shift && (
        <Button variant="outline" className="h-9 px-2.5" onClick={() => setShowMove(true)} title="Record cash in/out">
          <ArrowDownCircle className="h-4 w-4" />
        </Button>
      )}

      {/* Open modal */}
      <Modal open={showOpen} onClose={() => setShowOpen(false)} title="Open Cash Drawer" size="sm">
        <div className="space-y-3">
          <label className="block text-sm">
            <span className="mb-1 block text-[hsl(var(--muted-foreground))]">Opening cash (float)</span>
            <Input type="number" inputMode="decimal" value={openFloat} onChange={(e) => setOpenFloat(e.target.value)} placeholder="e.g. 5000" autoFocus />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-[hsl(var(--muted-foreground))]">Label (optional)</span>
            <Input value={openLabel} onChange={(e) => setOpenLabel(e.target.value)} placeholder="e.g. Counter 1" />
          </label>
          <div className="flex gap-2 pt-1">
            <Button variant="outline" className="flex-1" onClick={() => setShowOpen(false)} disabled={busy}>Cancel</Button>
            <Button className="flex-1" onClick={doOpen} disabled={busy}>{busy ? 'Opening...' : 'Open Drawer'}</Button>
          </div>
        </div>
      </Modal>

      {/* Close modal */}
      <Modal open={showClose} onClose={() => setShowClose(false)} title="Close Cash Drawer" size="sm">
        {breakdown && (
          <div className="space-y-3">
            <div className="rounded-lg border border-[hsl(var(--border))] p-3 text-sm space-y-1">
              <Row label="Opening float" value={breakdown.openingFloat} />
              <Row label="Cash sales + udhaar" value={breakdown.cashIn} />
              {breakdown.refunds > 0 && <Row label="Refunds" value={-breakdown.refunds} />}
              {breakdown.expenses > 0 && <Row label="Expenses" value={-breakdown.expenses} />}
              {breakdown.supplierCash > 0 && <Row label="Supplier cash" value={-breakdown.supplierCash} />}
              {breakdown.manualIn > 0 && <Row label="Cash added" value={breakdown.manualIn} />}
              {breakdown.manualOut > 0 && <Row label="Cash taken out" value={-breakdown.manualOut} />}
              <div className="flex justify-between border-t border-[hsl(var(--border))] pt-1 font-semibold">
                <span>Expected in drawer</span><span>{formatCurrency(breakdown.expected)}</span>
              </div>
            </div>
            <label className="block text-sm">
              <span className="mb-1 block text-[hsl(var(--muted-foreground))]">Counted cash</span>
              <Input type="number" inputMode="decimal" value={counted} onChange={(e) => setCounted(e.target.value)} placeholder="Count the drawer" autoFocus />
            </label>
            {counted !== '' && (
              <div className={`text-sm font-medium ${Math.abs(expectedClose) < 0.01 ? 'text-green-700' : expectedClose > 0 ? 'text-blue-700' : 'text-red-700'}`}>
                {Math.abs(expectedClose) < 0.01 ? 'Matches expected.' : expectedClose > 0 ? `Over by ${formatCurrency(expectedClose)}` : `Short by ${formatCurrency(Math.abs(expectedClose))}`}
              </div>
            )}
            <label className="block text-sm">
              <span className="mb-1 block text-[hsl(var(--muted-foreground))]">Note (optional)</span>
              <Input value={closeNote} onChange={(e) => setCloseNote(e.target.value)} placeholder="Reason for difference, handover note..." />
            </label>
            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1" onClick={() => setShowClose(false)} disabled={busy}>Cancel</Button>
              <Button variant="danger" className="flex-1" onClick={doClose} disabled={busy}>{busy ? 'Closing...' : 'Close Drawer'}</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Cash movement modal */}
      <Modal open={showMove} onClose={() => setShowMove(false)} title="Record Cash In / Out" size="sm">
        <div className="space-y-3">
          <label className="block text-sm">
            <span className="mb-1 block text-[hsl(var(--muted-foreground))]">Type</span>
            <select className="input h-10 w-full" value={moveType} onChange={(e) => setMoveType(e.target.value as any)}>
              {MOVE_TYPES.map((m) => (
                <option key={m.type} value={m.type}>{m.label} ({m.dir})</option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-[hsl(var(--muted-foreground))]">Amount</span>
            <Input type="number" inputMode="decimal" value={moveAmount} onChange={(e) => setMoveAmount(e.target.value)} placeholder="0" autoFocus />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-[hsl(var(--muted-foreground))]">Reason (optional)</span>
            <Input value={moveReason} onChange={(e) => setMoveReason(e.target.value)} placeholder="e.g. deposit to bank" />
          </label>
          <div className="flex gap-2 pt-1">
            <Button variant="outline" className="flex-1" onClick={() => setShowMove(false)} disabled={busy}>Cancel</Button>
            <Button className="flex-1" onClick={doMove} disabled={busy}>{busy ? 'Saving...' : 'Record'}</Button>
          </div>
        </div>
      </Modal>
    </>
  )
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between">
      <span className="text-[hsl(var(--muted-foreground))]">{label}</span>
      <span>{value < 0 ? `-${formatCurrency(Math.abs(value))}` : formatCurrency(value)}</span>
    </div>
  )
}
