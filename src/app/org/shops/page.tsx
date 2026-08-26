'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Power, PowerOff, AlertTriangle } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { ModalShell } from '@/components/ui/ModalShell'
import { BrandSpinner } from '@/components/ui/BrandSpinner'

interface Shop {
  id: string
  name: string
  city: string | null
  isActive: boolean
  pausedAt: string | null
  pausedReason: 'OWNER_CLOSED' | 'PLAN_DOWNGRADE' | null
  _count: {
    products: number
    customers: number
    invoices: number
  }
  createdAt: string
}

interface OpenShift {
  id: string
  label: string | null
  cashier: string | null
  openingFloat: number
  openedAt: string
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

  // Closing a shop locks out every cashier, so it goes through a confirm step
  // rather than a bare toggle.
  const [confirmShop, setConfirmShop] = useState<Shop | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [blockedShifts, setBlockedShifts] = useState<OpenShift[] | null>(null)
  const [blockedMessage, setBlockedMessage] = useState('')

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

  /**
   * Open or close a shop. Reopening is immediate; closing needs confirmation
   * first because it locks every cashier out of the till.
   */
  async function setShopActive(shop: Shop, isActive: boolean) {
    setTogglingId(shop.id)
    setError('')
    setBlockedShifts(null)
    setBlockedMessage('')
    try {
      const res = await fetch(`/api/org/stores/${shop.id}/active`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive }),
      })
      const data = await res.json()
      if (!res.ok) {
        // An open drawer holds counted cash only that cashier can reconcile, so
        // the API refuses and names them. Surface that instead of a generic error.
        if (data.error === 'OPEN_SHIFTS') {
          setBlockedShifts(data.openShifts || [])
          setBlockedMessage(data.message || 'Close the open cash drawers first.')
          setConfirmShop(null)
          return
        }
        throw new Error(data.message || data.error || 'Failed to update shop')
      }
      setConfirmShop(null)
      await load()
      await refreshUser()
    } catch (e: any) {
      setError(e.message || 'Failed to update shop')
    } finally {
      setTogglingId(null)
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

      // Platform admins stay in the org-scoped tree (where their full store nav +
      // breadcrumb are built); org admins / managers use the /store dashboard.
      if (user?.role === 'PLATFORM_ADMIN') {
        router.push(`/org/${user.currentOrgId}/stores/${shopId}`)
      } else {
        router.push('/store')
      }
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
        <div className="flex min-h-[50vh] items-center justify-center">
          <BrandSpinner size={40} />
        </div>
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
            <div
              key={shop.id}
              className={`bg-white rounded-xl shadow-md border p-6 hover:shadow-lg transition-shadow ${
                shop.isActive ? 'border-gray-200' : 'border-amber-300 bg-amber-50/40'
              }`}
            >
              <div className="flex items-start justify-between mb-4 gap-2">
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-semibold text-gray-900 mb-1 truncate">{shop.name}</h3>
                  <p className="text-sm text-gray-600">
                    {shop.city || 'No city specified'}
                  </p>
                  {!shop.isActive && (
                    <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800">
                      <PowerOff className="h-3.5 w-3.5" />
                      {shop.pausedReason === 'PLAN_DOWNGRADE'
                        ? 'Paused: not covered by your plan'
                        : 'Closed by owner'}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() =>
                    shop.isActive ? setConfirmShop(shop) : setShopActive(shop, true)
                  }
                  disabled={togglingId === shop.id}
                  title={shop.isActive ? 'Close this shop' : 'Reopen this shop'}
                  aria-label={shop.isActive ? 'Close this shop' : 'Reopen this shop'}
                  className={`shrink-0 rounded-lg p-2 transition-colors disabled:opacity-50 ${
                    shop.isActive
                      ? 'text-gray-400 hover:bg-gray-100 hover:text-gray-700'
                      : 'text-amber-600 hover:bg-amber-100 hover:text-amber-800'
                  }`}
                >
                  {shop.isActive ? <Power className="h-4 w-4" /> : <PowerOff className="h-4 w-4" />}
                </button>
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
                  {enteringStoreId === shop.id ? 'Entering...' : shop.isActive ? 'Enter Store' : 'View (read only)'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Refused because cash is still counted in an open drawer. Naming the
          cashier and the amount makes it actionable instead of just blocked. */}
      {blockedShifts && (
        <ModalShell onClose={() => setBlockedShifts(null)}>
            <div className="mb-3 flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Close the cash drawer first</h3>
                <p className="mt-1 text-sm text-gray-600">{blockedMessage}</p>
              </div>
            </div>
            {blockedShifts.length > 0 && (
              <ul className="mb-4 divide-y divide-gray-100 rounded-lg border border-gray-200">
                {blockedShifts.map((s) => (
                  <li key={s.id} className="flex items-center justify-between px-3 py-2 text-sm">
                    <span className="text-gray-900">
                      {s.cashier || 'Unknown cashier'}
                      {s.label ? <span className="text-gray-500"> ({s.label})</span> : null}
                    </span>
                    <span className="text-gray-500">
                      opened {new Date(s.openedAt).toLocaleString()}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <p className="mb-4 text-sm text-gray-500">
              Closing the shop now would leave that cash unaccounted for and the drawer could never
              be reconciled.
            </p>
            <button
              onClick={() => setBlockedShifts(null)}
              className="w-full rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800"
            >
              Got it
            </button>
        </ModalShell>
      )}

      {confirmShop && (
        <ModalShell onClose={() => setConfirmShop(null)}>
            <h3 className="text-lg font-semibold text-gray-900">Close {confirmShop.name}?</h3>
            <ul className="my-4 space-y-2 text-sm text-gray-600">
              <li>Managers and cashiers can still log in and read past records.</li>
              <li>No new sales, purchases or payments can be recorded.</li>
              <li>Nothing is deleted. Reopening restores the shop exactly as it is now.</li>
            </ul>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmShop(null)}
                className="flex-1 rounded-lg bg-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={() => setShopActive(confirmShop, false)}
                disabled={togglingId === confirmShop.id}
                className="flex-1 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
              >
                {togglingId === confirmShop.id ? 'Closing...' : 'Close shop'}
              </button>
            </div>
        </ModalShell>
      )}
    </div>
  )
}


