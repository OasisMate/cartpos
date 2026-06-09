'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import Button from '@/components/ui/Button'
import EmptyState from '@/components/ui/EmptyState'

interface Shop {
  id: string
  name: string
  city: string | null
  createdAt: string
  organization?: {
    id: string
    name: string
  }
  owners: Array<{
    user: {
      id: string
      name: string
      email: string
    }
  }>
  _count: {
    products: number
    customers: number
    invoices: number
  }
}

export default function AdminShopsPage() {
  const { user } = useAuth()
  const [shops, setShops] = useState<Shop[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    city: '',
    ownerName: '',
    ownerEmail: '',
    ownerPassword: '',
  })
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (user?.role === 'PLATFORM_ADMIN') {
      fetchShops()
    }
  }, [user])

  async function fetchShops() {
    try {
      const response = await fetch('/api/admin/shops')
      if (response.ok) {
        const data = await response.json()
        setShops(data.shops || [])
      }
    } catch (err) {
      console.error('Failed to fetch shops:', err)
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSubmitting(true)

    try {
      const response = await fetch('/api/admin/shops', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Failed to create shop')
        setSubmitting(false)
        return
      }

      // Reset form and refresh list
      setFormData({
        name: '',
        city: '',
        ownerName: '',
        ownerEmail: '',
        ownerPassword: '',
      })
      setShowForm(false)
      await fetchShops()
    } catch (err) {
      setError('An error occurred. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (user?.role !== 'PLATFORM_ADMIN') {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-4">Access Denied</h1>
        <p className="text-gray-600">Only admins can access this page.</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-4">Shops</h1>
        <p className="text-gray-600">Loading...</p>
      </div>
    )
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Shops</h1>
        <Button variant={showForm ? 'outline' : 'primary'} onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancel' : 'Create Shop'}
        </Button>
      </div>

      {showForm && (
        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <h2 className="text-lg font-semibold mb-4">Create New Shop</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 bg-red-50 text-red-800 rounded-md text-sm">
                {error}
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Shop Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  City
                </label>
                <input
                  type="text"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Owner Name *
              </label>
              <input
                type="text"
                required
                value={formData.ownerName}
                onChange={(e) => setFormData({ ...formData, ownerName: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Owner Email *
              </label>
              <input
                type="email"
                required
                value={formData.ownerEmail}
                onChange={(e) => setFormData({ ...formData, ownerEmail: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Owner Password *
              </label>
              <input
                type="password"
                required
                value={formData.ownerPassword}
                onChange={(e) => setFormData({ ...formData, ownerPassword: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500"
              />
            </div>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Creating...' : 'Create Shop'}
            </Button>
          </form>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full divide-y divide-gray-200 table-fixed">
          <thead className="bg-gray-50">
            <tr className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              <th className="px-4 py-3 w-[22%]">Shop Name</th>
              <th className="px-4 py-3 w-[20%]">Organization</th>
              <th className="px-4 py-3 w-[12%]">City</th>
              <th className="px-4 py-3 w-[26%]">Owner</th>
              <th className="px-4 py-3 w-[12%]">Stats</th>
              <th className="px-4 py-3 w-[8%]">Created</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200 align-top">
            {shops.map((shop) => (
              <tr key={shop.id}>
                <td className="px-4 py-3 text-sm font-medium text-gray-900 break-words">
                  {shop.name}
                </td>
                <td className="px-4 py-3 text-sm text-gray-500 break-words">
                  {shop.organization?.name || '-'}
                </td>
                <td className="px-4 py-3 text-sm text-gray-500 break-words">
                  {shop.city || '-'}
                </td>
                <td className="px-4 py-3 text-sm text-gray-700">
                  <div className="font-medium break-words">{shop.owners[0]?.user.name || '-'}</div>
                  {shop.owners[0]?.user.email && (
                    <div className="text-xs text-gray-400 break-words">{shop.owners[0]?.user.email}</div>
                  )}
                </td>
                <td className="px-4 py-3 text-xs text-gray-500">
                  <div>{shop._count.products} products</div>
                  <div>{shop._count.customers} customers</div>
                  <div>{shop._count.invoices} invoices</div>
                </td>
                <td className="px-4 py-3 text-xs text-gray-500">
                  {new Date(shop.createdAt).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {shops.length === 0 && (
          <EmptyState title="No shops yet" description="Create your first shop to get started." />
        )}
      </div>
    </div>
  )
}

