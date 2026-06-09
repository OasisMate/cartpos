'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { getCustomersWithCache } from '@/lib/offline/data'
import { Table, THead, TR, TH, TD, EmptyRow } from '@/components/ui/DataTable'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { formatCurrency } from '@/lib/utils/money'

interface Customer {
  id: string
  name: string
  phone: string | null
  balance?: number
}

export default function CustomersPage() {
  const { user } = useAuth()
  const isOnline = useOnlineStatus()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [onlyWithBalance, setOnlyWithBalance] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({ name: '', phone: '', notes: '', openingBalance: '' })
  const [submitting, setSubmitting] = useState(false)

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
      if (isOnline) {
        // Online: try API first
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
          setLoading(false)
          return
        } catch (apiError) {
          console.warn('API failed, falling back to cache:', apiError)
        }
      }
      
      // Offline or API failed: use cache
      const cached = await getCustomersWithCache(user!.currentShopId!, isOnline)
      let rows: Customer[] = cached.map((c) => ({
        id: c.id,
        name: c.name,
        phone: c.phone,
        balance: 0, // Balance calculation requires server data
      }))
      
      // Apply search filter
      if (search) {
        const term = search.toLowerCase()
        rows = rows.filter((c) => 
          c.name.toLowerCase().includes(term) ||
          (c.phone && c.phone.includes(term))
        )
      }
      
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
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or phone"
            className="h-9 w-72"
          />
          <Button className="h-9 px-4" variant="outline" onClick={load}>
            Search
          </Button>
          <Button
            className="h-9 px-4"
            onClick={() => {
              setFormData({ name: '', phone: '', notes: '', openingBalance: '' })
              setError('')
              setShowForm(true)
            }}
          >
            Add Customer
          </Button>
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

      {/* Add/Edit Customer Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md shadow-lg border border-gray-200">
            <h2 className="text-xl font-bold mb-4">Add Customer</h2>
            {error && (
              <div className="mb-3 p-2 bg-red-100 text-red-700 rounded text-sm">
                {error}
              </div>
            )}
            <form
              onSubmit={async (e) => {
                e.preventDefault()
                setSubmitting(true)
                setError('')
                try {
                  const res = await fetch('/api/customers', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(formData),
                  })
                  const data = await res.json()
                  if (!res.ok) {
                    throw new Error(data.error || 'Failed to create customer')
                  }
                  const created = data.customer as Customer
                  setCustomers((prev) => [created, ...prev])
                  setShowForm(false)
                  setFormData({ name: '', phone: '', notes: '', openingBalance: '' })
                } catch (err: any) {
                  setError(err.message || 'Failed to create customer')
                } finally {
                  setSubmitting(false)
                }
              }}
            >
              <div className="space-y-3 mb-4">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Name <span className="text-red-500">*</span>
                  </label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Phone</label>
                  <Input
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="Optional"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Notes</label>
                  <Input
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Optional"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Opening Balance</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.openingBalance}
                    onChange={(e) => setFormData({ ...formData, openingBalance: e.target.value })}
                    placeholder="0.00"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowForm(false)
                    setError('')
                  }}
                  disabled={submitting}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting ? 'Saving...' : 'Save'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-[hsl(var(--muted-foreground))]">Loading...</div>
      ) : customers.length === 0 ? (
        <div className="text-[hsl(var(--muted-foreground))]">No customers found</div>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <THead>
              <TR>
                <TH>Name</TH>
                <TH>Phone</TH>
                <TH className="text-right">Balance</TH>
                <TH className="text-right">Actions</TH>
              </TR>
            </THead>
            <tbody>
              {customers.length === 0 ? (
                <EmptyRow colSpan={4} message="No customers found" />
              ) : (
                customers.map((c) => (
                  <TR key={c.id}>
                    <TD>{c.name}</TD>
                    <TD>{c.phone || '—'}</TD>
                    <TD className="text-right">{formatCurrency(c.balance ?? 0)}</TD>
                    <TD className="text-right">
                      <Link href={`/store/customers/${c.id}`} className="btn btn-outline h-8 px-3">
                        View
                      </Link>
                    </TD>
                  </TR>
                ))
              )}
            </tbody>
          </Table>
        </div>
      )}
    </div>
  )
}

