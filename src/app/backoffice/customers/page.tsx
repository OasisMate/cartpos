'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'

interface Customer {
  id: string
  name: string
  phone: string | null
  balance?: number
}

export default function CustomersPage() {
  const { user } = useAuth()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [onlyWithBalance, setOnlyWithBalance] = useState(false)

  useEffect(() => {
    if (user?.currentShopId) {
      load()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.currentShopId])

  async function load() {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams()
      if (search) params.append('search', search)
      const res = await fetch(`/api/customers?${params.toString()}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load customers')
      let rows: Customer[] = data.customers || data || []
      if (onlyWithBalance) {
        rows = rows.filter((c) => (c.balance || 0) > 0)
      }
      setCustomers(rows)
    } catch (e: any) {
      setError(e.message || 'Failed to load')
    } finally {
      setLoading(false)
    }
  }

  if (!user?.currentShopId) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-2">Customers</h1>
        <p className="text-[hsl(var(--muted-foreground))]">Please select a shop first</p>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Customers</h1>
        <div className="flex gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or phone"
            className="input h-9 w-72"
          />
          <button className="btn btn-primary h-9 px-4" onClick={load}>
            Search
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-4">
        <input
          id="only-balance"
          type="checkbox"
          checked={onlyWithBalance}
          onChange={(e) => setOnlyWithBalance(e.target.checked)}
        />
        <label htmlFor="only-balance" className="text-sm">
          Show only customers with balance
        </label>
      </div>

      {error && <div className="mb-3 p-3 bg-red-100 text-red-700 rounded">{error}</div>}

      {loading ? (
        <div className="text-[hsl(var(--muted-foreground))]">Loading...</div>
      ) : customers.length === 0 ? (
        <div className="text-[hsl(var(--muted-foreground))]">No customers found</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-[hsl(var(--border))]">
            <thead className="bg-[hsl(var(--muted))]">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wider">
                  Name
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wider">
                  Phone
                </th>
                <th className="px-4 py-2 text-right text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wider">
                  Balance
                </th>
                <th className="px-4 py-2 text-right text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-[hsl(var(--card))] divide-y divide-[hsl(var(--border))]">
              {customers.map((c) => (
                <tr key={c.id}>
                  <td className="px-4 py-2 text-sm">{c.name}</td>
                  <td className="px-4 py-2 text-sm">{c.phone || '—'}</td>
                  <td className="px-4 py-2 text-sm text-right">{(c.balance ?? 0).toFixed(2)}</td>
                  <td className="px-4 py-2 text-sm text-right">
                    <Link href={`/backoffice/customers/${c.id}`} className="btn btn-outline h-8 px-3">
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

