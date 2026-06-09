'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { formatCurrency } from '@/lib/utils/money'
import { SkeletonCards } from '@/components/ui/Skeleton'

interface RangeSummary {
  from: string
  to: string
  totalSales: number
  totalInvoices: number
  totalUdhaar: number
  totalPaymentsReceived: number
  costOfGoods: number
  grossProfit: number
}

type Preset = 'TODAY' | 'YESTERDAY' | 'LAST_7_DAYS' | 'LAST_30_DAYS' | 'CUSTOM'

function formatRangeLabel(from: string, to: string) {
  if (from === to) return from
  return `${from} → ${to}`
}

export default function ReportsPage() {
  const { user } = useAuth()
  const today = new Date().toISOString().split('T')[0]

  const [preset, setPreset] = useState<Preset>('TODAY')
  const [from, setFrom] = useState<string>(today)
  const [to, setTo] = useState<string>(today)
  const [summary, setSummary] = useState<RangeSummary | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function applyPreset(next: Preset) {
    const now = new Date()
    let start = today
    let end = today

    if (next === 'YESTERDAY') {
      const d = new Date(now)
      d.setDate(d.getDate() - 1)
      const iso = d.toISOString().split('T')[0]
      start = iso
      end = iso
    } else if (next === 'LAST_7_DAYS') {
      const d = new Date(now)
      d.setDate(d.getDate() - 6)
      start = d.toISOString().split('T')[0]
      end = today
    } else if (next === 'LAST_30_DAYS') {
      const d = new Date(now)
      d.setDate(d.getDate() - 29)
      start = d.toISOString().split('T')[0]
      end = today
    }

    setPreset(next)
    if (next !== 'CUSTOM') {
      setFrom(start)
      setTo(end)
      void fetchSummary(start, end)
    }
  }

  async function fetchSummary(fromDate: string, toDate: string) {
    if (!user?.currentShopId) return
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams({ from: fromDate, to: toDate })
      const resp = await fetch(`/api/reports/summary?${params.toString()}`)
      const data = await resp.json()
      if (!resp.ok) {
        throw new Error(data.error || 'Failed to load summary')
      }
      setSummary(data.summary)
    } catch (err: any) {
      setError(err.message || 'Failed to load summary')
      setSummary(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    applyPreset('TODAY')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.currentShopId])

  const showCustomDates = preset === 'CUSTOM'

  return (
    <div className="p-6 space-y-4">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold mb-1">Reports</h1>
          {summary && (
            <p className="text-sm text-gray-600">
              Period:{' '}
              <span className="font-medium">
                {formatRangeLabel(summary.from, summary.to)}
              </span>
            </p>
          )}
        </div>
        <div className="flex flex-col md:flex-row gap-3 items-start md:items-center">
          <div className="inline-flex rounded-md shadow-sm border bg-white overflow-hidden">
            {([
              ['TODAY', 'Today'],
              ['YESTERDAY', 'Yesterday'],
              ['LAST_7_DAYS', 'Last 7 days'],
              ['LAST_30_DAYS', 'Last 30 days'],
              ['CUSTOM', 'Custom'],
            ] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => applyPreset(value)}
                className={`px-3 py-1.5 text-xs md:text-sm border-l first:border-l-0 ${
                  preset === value
                    ? 'bg-orange-500 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {showCustomDates && (
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="px-3 py-2 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-gray-500 text-sm">to</span>
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="px-3 py-2 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={() => fetchSummary(from, to)}
                className="px-4 py-2 rounded bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
              >
                Apply
              </button>
            </div>
          )}
        </div>
      </div>

      {error && <div className="mb-2 p-3 bg-red-100 text-red-700 rounded text-sm">{error}</div>}

      {loading ? (
        <SkeletonCards count={6} />
      ) : summary ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white border rounded-lg p-4 shadow-sm">
            <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">Total Sales</div>
            <div className="text-2xl font-semibold">{formatCurrency(summary.totalSales)}</div>
          </div>
          <div className="bg-white border rounded-lg p-4 shadow-sm">
            <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">Invoices</div>
            <div className="text-2xl font-semibold">{summary.totalInvoices}</div>
          </div>
          <div className="bg-white border rounded-lg p-4 shadow-sm">
            <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">Udhaar (Sales)</div>
            <div className="text-2xl font-semibold text-red-600">
              {formatCurrency(summary.totalUdhaar)}
            </div>
          </div>
          <div className="bg-white border rounded-lg p-4 shadow-sm">
            <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">
              Payments Received
            </div>
            <div className="text-2xl font-semibold text-emerald-700">
              {formatCurrency(summary.totalPaymentsReceived)}
            </div>
          </div>
          <div className="bg-white border rounded-lg p-4 shadow-sm">
            <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">Cost of Goods</div>
            <div className="text-2xl font-semibold">{formatCurrency(summary.costOfGoods)}</div>
          </div>
          <div className="bg-white border-2 border-emerald-200 rounded-lg p-4 shadow-sm">
            <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">Gross Profit</div>
            <div className={`text-2xl font-semibold ${summary.grossProfit >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
              {formatCurrency(summary.grossProfit)}
            </div>
            <div className="text-[11px] text-gray-400 mt-1">Sales − cost of goods sold</div>
          </div>
        </div>
      ) : (
        <div className="text-gray-600 text-sm">No data for this period.</div>
      )}
    </div>
  )
}

