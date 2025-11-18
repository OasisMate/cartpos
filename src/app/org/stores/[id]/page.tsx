'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { Store, ArrowLeft, Settings } from 'lucide-react'
import Link from 'next/link'

interface StoreData {
  id: string
  name: string
  city: string | null
  phone: string | null
  addressLine1: string | null
  addressLine2: string | null
  createdAt: string
  _count: {
    products: number
    customers: number
    invoices: number
    purchases: number
  }
}

export default function StoreDetailPage() {
  const router = useRouter()
  const params = useParams()
  const { user } = useAuth()
  const storeId = ((params as any).id as string) || ((params as any).storeId as string)

  const [store, setStore] = useState<StoreData | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [isEditing, setIsEditing] = useState(false)

  const [formData, setFormData] = useState({
    name: '',
    city: '',
    phone: '',
    addressLine1: '',
    addressLine2: '',
  })

  const loadStore = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/org/stores/${storeId}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load store')
      
      setStore(data.store)
      setFormData({
        name: data.store.name || '',
        city: data.store.city || '',
        phone: data.store.phone || '',
        addressLine1: data.store.addressLine1 || '',
        addressLine2: data.store.addressLine2 || '',
      })
    } catch (e: any) {
      setError(e.message || 'Failed to load store')
    } finally {
      setLoading(false)
    }
  }, [storeId])

  useEffect(() => {
    if (user && storeId) {
      loadStore()
    }
  }, [user, storeId, loadStore])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    setSuccess('')

    try {
      const res = await fetch(`/api/org/stores/${storeId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to update store')

      setSuccess('Store updated successfully')
      setIsEditing(false)
      await loadStore()
      setTimeout(() => setSuccess(''), 3000)
    } catch (e: any) {
      setError(e.message || 'Failed to update store')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!confirm('Are you sure you want to delete this store? This action cannot be undone.')) {
      return
    }

    setSaving(true)
    setError('')
    try {
      const res = await fetch(`/api/org/stores/${storeId}`, {
        method: 'DELETE',
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to delete store')

      router.push('/org/stores')
      router.refresh()
    } catch (e: any) {
      setError(e.message || 'Failed to delete store')
      setSaving(false)
    }
  }

  if (!user) {
    return null
  }

  if (!storeId) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-red-600">Invalid store context</div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-600">Loading...</div>
      </div>
    )
  }

  if (!store) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-red-600">Store not found</div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto py-8">
      <div className="mb-6">
        <Link
          href="/org/stores"
          className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Stores
        </Link>
        <h1 className="text-3xl font-bold mb-2 bg-gradient-to-r from-blue-600 to-orange-600 bg-clip-text text-transparent flex items-center gap-3">
          <Store className="h-8 w-8 text-blue-600" />
          {store.name}
        </h1>
        <p className="text-gray-600">Store details and settings</p>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {success && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-sm text-green-600">{success}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Store Information */}
          <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900">Store Information</h2>
              {!isEditing && (
                <button
                  onClick={() => setIsEditing(true)}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors duration-200 text-sm"
                >
                  Edit
                </button>
              )}
            </div>

            {isEditing ? (
              <form onSubmit={handleSave} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Store Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    disabled={saving}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all disabled:bg-gray-50 disabled:cursor-not-allowed"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">City</label>
                    <input
                      type="text"
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      disabled={saving}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all disabled:bg-gray-50 disabled:cursor-not-allowed"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Phone</label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      disabled={saving}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all disabled:bg-gray-50 disabled:cursor-not-allowed"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Address Line 1</label>
                  <input
                    type="text"
                    value={formData.addressLine1}
                    onChange={(e) => setFormData({ ...formData, addressLine1: e.target.value })}
                    disabled={saving}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all disabled:bg-gray-50 disabled:cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Address Line 2</label>
                  <input
                    type="text"
                    value={formData.addressLine2}
                    onChange={(e) => setFormData({ ...formData, addressLine2: e.target.value })}
                    disabled={saving}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all disabled:bg-gray-50 disabled:cursor-not-allowed"
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditing(false)
                      loadStore()
                    }}
                    disabled={saving}
                    className="px-6 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-4">
                <div>
                  <span className="text-sm font-medium text-gray-700">Store Name:</span>
                  <p className="text-gray-900">{store.name}</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <span className="text-sm font-medium text-gray-700">City:</span>
                    <p className="text-gray-900">{store.city || '—'}</p>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-700">Phone:</span>
                    <p className="text-gray-900">{store.phone || '—'}</p>
                  </div>
                </div>
                {store.addressLine1 && (
                  <div>
                    <span className="text-sm font-medium text-gray-700">Address:</span>
                    <p className="text-gray-900">
                      {store.addressLine1}
                      {store.addressLine2 && `, ${store.addressLine2}`}
                    </p>
                  </div>
                )}
                <div>
                  <span className="text-sm font-medium text-gray-700">Created:</span>
                  <p className="text-gray-900">{new Date(store.createdAt).toLocaleDateString()}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Stats */}
          <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Statistics</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Products</span>
                <span className="font-semibold text-gray-900">{store._count.products}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Customers</span>
                <span className="font-semibold text-gray-900">{store._count.customers}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Invoices</span>
                <span className="font-semibold text-gray-900">{store._count.invoices}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Purchases</span>
                <span className="font-semibold text-gray-900">{store._count.purchases}</span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Actions</h3>
            <div className="space-y-3">
              <Link
                href={`/org/stores/${storeId}/settings`}
                className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors duration-200"
              >
                <Settings className="h-4 w-4" />
                Store Settings
              </Link>
              <button
                onClick={handleDelete}
                disabled={saving}
                className="w-full px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Deleting...' : 'Delete Store'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

