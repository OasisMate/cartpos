'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'

interface DailySummary {
  date: string
  totalSales: number
  totalInvoices: number
  totalUdhaar: number
  totalPaymentsReceived: number
}

export default function ReportsPage() {
  const { user } = useAuth()
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0])
  const [summary, setSummary] = useState<DailySummary | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function fetchSummary(selectedDate: string) {
    if (!user?.currentShopId) return
    setLoading(true)
    setError('')
    try {
      const resp = await fetch(`/api/reports/daily?date=${selectedDate}`)
      const data = await resp.json()
      if (!resp.ok) {
        throw new Error(data.error || 'Failed to load daily summary')
      }
      setSummary(data.summary)
    } catch (err: any) {
      setError(err.message || 'Failed to load daily summary')
      setSummary(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSummary(date)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.currentShopId])

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Reports</h1>

      <div className="mb-4 flex items-center gap-3">
        <label className="text-sm text-gray-700">Date</label>
        <input
          type="date"
          value={date}
          onChange={(e) => {
            const d = e.target.value
            setDate(d)
            fetchSummary(d)
          }}
          className="px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {error && <div className="mb-4 p-3 bg-red-100 text-red-700 rounded">{error}</div>}

      {loading ? (
        <div>Loading...</div>
      ) : summary ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white border rounded p-4">
            <div className="text-sm text-gray-500">Total Sales</div>
            <div className="text-xl font-semibold">Rs {summary.totalSales.toFixed(2)}</div>
          </div>
          <div className="bg-white border rounded p-4">
            <div className="text-sm text-gray-500">Invoices</div>
            <div className="text-xl font-semibold">{summary.totalInvoices}</div>
          </div>
          <div className="bg-white border rounded p-4">
            <div className="text-sm text-gray-500">Udhaar (Sales)</div>
            <div className="text-xl font-semibold">Rs {summary.totalUdhaar.toFixed(2)}</div>
          </div>
          <div className="bg-white border rounded p-4">
            <div className="text-sm text-gray-500">Payments Received</div>
            <div className="text-xl font-semibold">Rs {summary.totalPaymentsReceived.toFixed(2)}</div>
          </div>
        </div>
      ) : (
        <div className="text-gray-600">No data for this date.</div>
      )}
    </div>
  )
}

