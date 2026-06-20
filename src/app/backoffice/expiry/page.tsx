'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { AlertTriangle, CalendarClock } from 'lucide-react'

interface ExpiryLot {
  id: string
  productName: string
  unit: string
  lotNo: string | null
  expiry: string
  quantity: number
  status: 'EXPIRED' | 'EXPIRING'
  daysLeft: number
}

export default function ExpiryPage() {
  const { user } = useAuth()
  const [expired, setExpired] = useState<ExpiryLot[]>([])
  const [expiring, setExpiring] = useState<ExpiryLot[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    fetch('/api/stock/expiry?days=60')
      .then((r) => r.json())
      .then((d) => { if (active) { setExpired(d.expired || []); setExpiring(d.expiring || []) } })
      .catch(() => {})
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [user?.currentShopId])

  function table(rows: ExpiryLot[], tone: 'red' | 'amber') {
    if (rows.length === 0) return <p className="text-sm text-gray-500">None.</p>
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="text-left text-gray-500 border-b">
              <th className="py-2 pr-4">Product</th>
              <th className="py-2 pr-4">Batch</th>
              <th className="py-2 pr-4">Expiry</th>
              <th className="py-2 pr-4 text-right">Qty</th>
              <th className="py-2 pr-4 text-right">{tone === 'red' ? 'Expired' : 'Days left'}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((l) => (
              <tr key={l.id} className="border-b last:border-0">
                <td className="py-2 pr-4 font-medium">{l.productName}</td>
                <td className="py-2 pr-4">{l.lotNo || '-'}</td>
                <td className="py-2 pr-4">{l.expiry}</td>
                <td className="py-2 pr-4 text-right tabular-nums">{l.quantity} {l.unit}</td>
                <td className={`py-2 pr-4 text-right tabular-nums ${tone === 'red' ? 'text-red-600' : 'text-amber-600'}`}>
                  {tone === 'red' ? `${Math.abs(l.daysLeft)}d ago` : `${l.daysLeft}d`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-1 flex items-center gap-2">
          <CalendarClock className="h-7 w-7 text-blue-600" /> Expiry alerts
        </h1>
        <p className="text-gray-600">Batches expired or expiring within 60 days. Sell or remove these first.</p>
        <p className="mt-1 text-sm text-gray-500">
          Batches come from stock-in: add a <span className="font-medium">Batch #</span> and{' '}
          <span className="font-medium">Expiry</span> on each line when you record a{' '}
          <a href="/store/purchases" className="text-blue-600 hover:underline">Purchase</a>.
        </p>
      </div>

      {loading ? (
        <div className="text-gray-600">Loading...</div>
      ) : (
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              <h2 className="text-lg font-semibold text-gray-900">Expired ({expired.length})</h2>
            </div>
            {table(expired, 'red')}
          </div>
          <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-3">
              <CalendarClock className="h-5 w-5 text-amber-600" />
              <h2 className="text-lg font-semibold text-gray-900">Expiring soon ({expiring.length})</h2>
            </div>
            {table(expiring, 'amber')}
          </div>
        </div>
      )}
    </div>
  )
}
