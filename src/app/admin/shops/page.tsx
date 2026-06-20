'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Eye } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import IconButton from '@/components/ui/IconButton'
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
  const router = useRouter()
  const [shops, setShops] = useState<Shop[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [openingId, setOpeningId] = useState<string | null>(null)

  useEffect(() => {
    if (user?.role === 'PLATFORM_ADMIN') {
      fetchShops()
    }
  }, [user])

  // Jump straight into a store's content. The parent /org layout requires a
  // currentOrgId cookie, so (like "Enter Org") we select the org first, then
  // navigate to the store drill-down. The store layouts read orgId/storeId from
  // the URL, so PLATFORM_ADMIN sees the full store view.
  async function viewStore(shop: Shop) {
    const orgId = shop.organization?.id
    if (!orgId || openingId) return
    setOpeningId(shop.id)
    try {
      const res = await fetch('/api/org/select', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error || 'Failed to open store')
      }
      router.push(`/org/${orgId}/stores/${shop.id}`)
    } catch (err: any) {
      setError(err.message || 'Failed to open store')
      setOpeningId(null)
    }
  }

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
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Shops</h1>
        <p className="mt-1 text-sm text-gray-500">
          All stores across every organization. To add a store, open its organization and create it from the Stores tab.
        </p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 text-red-800 rounded-md text-sm">{error}</div>
      )}

      {/* Desktop table */}
      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full divide-y divide-gray-200 table-fixed">
          <thead className="bg-gray-50">
            <tr className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              <th className="px-4 py-3 w-[20%]">Shop Name</th>
              <th className="px-4 py-3 w-[18%]">Organization</th>
              <th className="px-4 py-3 w-[11%]">City</th>
              <th className="px-4 py-3 w-[24%]">Owner</th>
              <th className="px-4 py-3 w-[11%]">Stats</th>
              <th className="px-4 py-3 w-[8%]">Created</th>
              <th className="px-4 py-3 w-[8%] text-right">View</th>
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
                <td className="px-4 py-3 text-right">
                  <IconButton
                    variant="primary"
                    label={shop.organization ? `View ${shop.name}` : 'No organization'}
                    disabled={!shop.organization || openingId === shop.id}
                    onClick={() => viewStore(shop)}
                  >
                    <Eye className="h-4 w-4" />
                  </IconButton>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {shops.length === 0 && (
          <EmptyState title="No shops yet" description="Create your first shop to get started." />
        )}
      </div>

      {/* Mobile cards */}
      <div className="space-y-3 sm:hidden">
        {shops.map((shop) => (
          <div key={shop.id} className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-semibold text-gray-900 break-words">{shop.name}</div>
                <div className="text-sm text-gray-500 break-words">
                  {shop.organization?.name || 'No organization'}
                  {shop.city ? ` · ${shop.city}` : ''}
                </div>
              </div>
              <IconButton
                variant="primary"
                label={shop.organization ? `View ${shop.name}` : 'No organization'}
                disabled={!shop.organization || openingId === shop.id}
                onClick={() => viewStore(shop)}
                className="flex-shrink-0"
              >
                <Eye className="h-4 w-4" />
              </IconButton>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
              <div className="text-gray-500">Owner</div>
              <div className="text-right text-gray-800 break-words">{shop.owners[0]?.user.name || '-'}</div>
              <div className="text-gray-500">Products</div>
              <div className="text-right text-gray-800">{shop._count.products}</div>
              <div className="text-gray-500">Customers</div>
              <div className="text-right text-gray-800">{shop._count.customers}</div>
              <div className="text-gray-500">Invoices</div>
              <div className="text-right text-gray-800">{shop._count.invoices}</div>
              <div className="text-gray-500">Created</div>
              <div className="text-right text-gray-800">{new Date(shop.createdAt).toLocaleDateString()}</div>
            </div>
          </div>
        ))}
        {shops.length === 0 && (
          <EmptyState title="No shops yet" description="Create your first shop to get started." />
        )}
      </div>
    </div>
  )
}

