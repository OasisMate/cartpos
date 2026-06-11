'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { Table, THead, TR, TH, EmptyRow } from '@/components/ui/DataTable'
import EmptyState from '@/components/ui/EmptyState'
import { formatCurrency } from '@/lib/utils/money'
import { Plus } from 'lucide-react'

interface QuotationRow {
  id: string
  number: string | null
  status: 'OPEN' | 'CONVERTED' | 'CANCELLED'
  total: string | number
  createdAt: string
  customerName: string | null
  customer: { name: string } | null
  _count: { lines: number }
}

const STATUSES = ['ALL', 'OPEN', 'CONVERTED', 'CANCELLED'] as const

const statusBadge: Record<string, string> = {
  OPEN: 'bg-blue-50 text-blue-700 border border-blue-100',
  CONVERTED: 'bg-emerald-50 text-emerald-700 border border-emerald-100',
  CANCELLED: 'bg-gray-100 text-gray-500 border border-gray-200',
}

export default function QuotationsPage() {
  const { user } = useAuth()
  const [rows, setRows] = useState<QuotationRow[]>([])
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState<(typeof STATUSES)[number]>('ALL')
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')

  async function load() {
    if (!user?.currentShopId) return
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams()
      if (status !== 'ALL') params.set('status', status)
      if (search) params.set('search', search)
      const res = await fetch(`/api/quotations?${params.toString()}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load quotations')
      setRows(data.quotations || [])
    } catch (e: any) {
      setError(e.message || 'Failed to load')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.currentShopId, status])

  if (!user?.currentShopId) {
    return <div className="p-6"><h1 className="text-2xl font-bold">Quotations</h1><p className="text-gray-600">Please select a shop first</p></div>
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Quotations</h1>
        <Link href="/store/quotations/new" className="btn btn-primary h-9 px-4 inline-flex items-center gap-2">
          <Plus className="h-4 w-4" />
          <span>New Quotation</span>
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="inline-flex overflow-hidden rounded-md border bg-white">
          {STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatus(s)}
              className={`px-3 py-1.5 text-xs md:text-sm border-l first:border-l-0 ${status === s ? 'bg-orange-500 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
            >
              {s === 'ALL' ? 'All' : s.charAt(0) + s.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
        <form onSubmit={(e) => { e.preventDefault(); load() }} className="flex gap-2">
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search number or customer" className="h-9 w-64" />
          <Button type="submit" variant="outline" className="h-9 px-4">Search</Button>
        </form>
      </div>

      {error && <div className="mb-3 p-3 bg-red-100 text-red-700 rounded">{error}</div>}

      {loading ? (
        <div className="text-[hsl(var(--muted-foreground))]">Loading...</div>
      ) : rows.length === 0 ? (
        <EmptyState title="No quotations" description="Create a quotation to give a customer a price estimate before the sale." />
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <THead>
              <TR>
                <TH>Number</TH>
                <TH>Date</TH>
                <TH>Customer</TH>
                <TH className="text-right">Items</TH>
                <TH className="text-right">Total</TH>
                <TH>Status</TH>
              </TR>
            </THead>
            <tbody>
              {rows.length === 0 ? (
                <EmptyRow colSpan={6} message="No quotations" />
              ) : (
                rows.map((q) => (
                  <tr key={q.id} className="border-b border-[hsl(var(--border))] hover:bg-[hsl(var(--muted))]">
                    <td className="py-2 px-3">
                      <Link href={`/store/quotations/${q.id}`} className="font-medium text-orange-600 hover:underline">
                        {q.number || q.id.slice(0, 8)}
                      </Link>
                    </td>
                    <td className="py-2 px-3">{new Date(q.createdAt).toLocaleDateString()}</td>
                    <td className="py-2 px-3">{q.customer?.name || q.customerName || '-'}</td>
                    <td className="py-2 px-3 text-right">{q._count.lines}</td>
                    <td className="py-2 px-3 text-right font-medium">{formatCurrency(Number(q.total))}</td>
                    <td className="py-2 px-3">
                      <span className={`px-2 py-0.5 rounded-full text-[11px] uppercase tracking-wide ${statusBadge[q.status]}`}>
                        {q.status.toLowerCase()}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </Table>
        </div>
      )}
    </div>
  )
}
