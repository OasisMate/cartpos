'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'

interface Shop {
  id: string
  name: string
  city: string | null
  _count: {
    products: number
    customers: number
    invoices: number
  }
  createdAt: string
}

export default function OrgShopsPage() {
  const { user } = useAuth()
  const [shops, setShops] = useState<Shop[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [city, setCity] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (user) load()
  }, [user])

  async function load() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/org/shops')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load shops')
      setShops(data.shops || [])
    } catch (e: any) {
      setError(e.message || 'Failed to load')
    } finally {
      setLoading(false)
    }
  }

  async function onCreate(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!name) {
      setError('Shop name is required')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/org/shops', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, city }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to create shop')
      setName('')
      setCity('')
      setShowForm(false)
      await load()
    } catch (e: any) {
      setError(e.message || 'Failed to create shop')
    } finally {
      setSubmitting(false)
    }
  }

  if (!user) {
    return null
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">My Shops</h1>
          <p className="text-[hsl(var(--muted-foreground))]">Manage shops in this organization</p>
        </div>
        <button
          className="btn btn-primary h-9 px-4"
          onClick={() => setShowForm((v) => !v)}
        >
          {showForm ? 'Cancel' : 'New Shop'}
        </button>
      </div>

      {showForm && (
        <div className="card mb-6">
          <div className="card-body">
            <h2 className="font-semibold mb-3">Create Shop</h2>
            {error && <div className="mb-3 p-3 bg-red-100 text-red-700 rounded">{error}</div>}
            <form onSubmit={onCreate} className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <input
                className="input"
                placeholder="Shop name *"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
              <input
                className="input"
                placeholder="City"
                value={city}
                onChange={(e) => setCity(e.target.value)}
              />
              <button className="btn btn-primary h-9 px-4" disabled={submitting}>
                {submitting ? 'Creating...' : 'Create'}
              </button>
            </form>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-[hsl(var(--muted-foreground))]">Loading...</div>
      ) : shops.length === 0 ? (
        <div className="text-[hsl(var(--muted-foreground))]">No shops yet.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {shops.map((shop) => (
            <div key={shop.id} className="card">
              <div className="card-body">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold">{shop.name}</div>
                    <div className="text-sm text-[hsl(var(--muted-foreground))]">
                      {shop.city || '—'}
                    </div>
                  </div>
                  <div className="text-sm text-[hsl(var(--muted-foreground))]">
                    {new Date(shop.createdAt).toLocaleDateString()}
                  </div>
                </div>
                <div className="mt-3 text-sm text-[hsl(var(--muted-foreground))]">
                  {shop._count.products} products · {shop._count.customers} customers ·{' '}
                  {shop._count.invoices} invoices
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}


