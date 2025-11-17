'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
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
  const router = useRouter()
  const { user, refreshUser } = useAuth()
  const [shops, setShops] = useState<Shop[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [city, setCity] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [enteringStoreId, setEnteringStoreId] = useState<string | null>(null)

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
      setError('Store name is required')
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
      if (!res.ok) throw new Error(data.error || 'Failed to create store')
      setName('')
      setCity('')
      setShowForm(false)
      await load()
    } catch (e: any) {
      setError(e.message || 'Failed to create store')
    } finally {
      setSubmitting(false)
    }
  }

  async function enterStore(shopId: string) {
    try {
      setEnteringStoreId(shopId)
      setError('')
      
      // Ensure org context is set (should already be set for org admin)
      if (!user?.currentOrgId) {
        throw new Error('Organization context not set')
      }

      // Call store select API (using shop/select endpoint)
      const res = await fetch('/api/shop/select', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shopId }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to enter store')
      }

      // Refresh user context
      await refreshUser()
      
      // Redirect to store dashboard
      router.push('/store')
      router.refresh()
    } catch (e: any) {
      setError(e.message || 'Failed to enter store')
      setEnteringStoreId(null)
    }
  }

  if (!user) {
    return null
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold mb-2 bg-gradient-to-r from-blue-600 to-orange-600 bg-clip-text text-transparent">
            Stores Management
          </h1>
          <p className="text-gray-600">Manage stores in this organization</p>
        </div>
        <button
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors duration-200"
          onClick={() => setShowForm((v) => !v)}
        >
          {showForm ? 'Cancel' : 'New Store'}
        </button>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {showForm && (
        <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4 text-gray-900">Create Store</h2>
          <form onSubmit={onCreate} className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <input
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
              placeholder="Store name *"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
            <input
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
              placeholder="City"
              value={city}
              onChange={(e) => setCity(e.target.value)}
            />
            <button
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={submitting}
            >
              {submitting ? 'Creating...' : 'Create Store'}
            </button>
          </form>
        </div>
      )}

      {loading ? (
        <div className="text-gray-600">Loading...</div>
      ) : shops.length === 0 ? (
        <div className="bg-white rounded-xl shadow-md border border-gray-200 p-8 text-center">
          <p className="text-gray-600 mb-4">No stores yet.</p>
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors duration-200"
          >
            Create First Store
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {shops.map((shop) => (
            <div key={shop.id} className="bg-white rounded-xl shadow-md border border-gray-200 p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">{shop.name}</h3>
                  <p className="text-sm text-gray-600">
                    {shop.city || 'No city specified'}
                  </p>
                </div>
              </div>
              
              <div className="mb-4 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Products:</span>
                  <span className="font-medium text-gray-900">{shop._count.products}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Customers:</span>
                  <span className="font-medium text-gray-900">{shop._count.customers}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Invoices:</span>
                  <span className="font-medium text-gray-900">{shop._count.invoices}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Created:</span>
                  <span className="text-gray-500">
                    {new Date(shop.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>

              <div className="flex gap-2 pt-4 border-t border-gray-200">
                <button
                  onClick={() => router.push(`/org/stores/${shop.id}`)}
                  className="flex-1 px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold rounded-lg transition-colors duration-200 text-sm"
                >
                  Edit
                </button>
                <button
                  onClick={() => enterStore(shop.id)}
                  disabled={enteringStoreId === shop.id}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                  {enteringStoreId === shop.id ? 'Entering...' : 'Enter Store'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}


