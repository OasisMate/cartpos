'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { User, ArrowLeft, Mail, Phone, CreditCard, Store, Trash2, Plus } from 'lucide-react'
import { formatCNIC } from '@/lib/validation'
import Link from 'next/link'

interface UserData {
  id: string
  name: string
  email: string
  phone: string | null
  cnic: string | null
  isWhatsApp: boolean
  platformRole: string
  orgRole: string
  shops: Array<{
    shopId: string
    shopRole: string
    shop: {
      id: string
      name: string
    }
  }>
  createdAt: string
}

interface Shop {
  id: string
  name: string
}

export default function UserDetailPage() {
  const router = useRouter()
  const params = useParams()
  const { user } = useAuth()
  const userId = ((params as any).id as string) || ((params as any).userId as string)

  const [userData, setUserData] = useState<UserData | null>(null)
  const [shops, setShops] = useState<Shop[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [isEditing, setIsEditing] = useState(false)
  const [showAssignForm, setShowAssignForm] = useState(false)

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    cnic: '',
    isWhatsApp: false,
    orgRole: null as string | null,
  })

  const [assignData, setAssignData] = useState({
    shopId: '',
    shopRole: 'STORE_MANAGER',
  })

  const loadUser = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/org/users/${userId}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load user')
      
      setUserData(data.user)
      setFormData({
        name: data.user.name || '',
        phone: data.user.phone || '',
        cnic: data.user.cnic || '',
        isWhatsApp: data.user.isWhatsApp || false,
        orgRole: data.user.orgRole || null,
      })
    } catch (e: any) {
      setError(e.message || 'Failed to load user')
    } finally {
      setLoading(false)
    }
  }, [userId])

  const loadShops = useCallback(async () => {
    try {
      const res = await fetch('/api/org/shops')
      const data = await res.json()
      if (res.ok) {
        setShops(data.shops || [])
      }
    } catch (e) {
      console.error('Failed to load shops:', e)
    }
  }, [])

  useEffect(() => {
    if (user && userId) {
      loadUser()
      loadShops()
    }
  }, [user, userId, loadUser, loadShops])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    setSuccess('')

    try {
      const payload = {
        name: formData.name,
        phone: formData.phone?.trim() || null,
        cnic: formData.cnic?.trim() || null,
        isWhatsApp: formData.isWhatsApp,
        orgRole: formData.orgRole || null,
      }

      const res = await fetch(`/api/org/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to update user')

      setSuccess('User updated successfully')
      setIsEditing(false)
      await loadUser()
      setTimeout(() => setSuccess(''), 3000)
    } catch (e: any) {
      setError(e.message || 'Failed to update user')
    } finally {
      setSaving(false)
    }
  }

  async function handleAssignStore() {
    if (!assignData.shopId) {
      setError('Please select a store')
      return
    }

    setSaving(true)
    setError('')
    try {
      const res = await fetch(`/api/org/users/${userId}/assign-store`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(assignData),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to assign store')

      setSuccess('Store assigned successfully')
      setAssignData({ shopId: '', shopRole: 'STORE_MANAGER' })
      setShowAssignForm(false)
      await loadUser()
      setTimeout(() => setSuccess(''), 3000)
    } catch (e: any) {
      setError(e.message || 'Failed to assign store')
    } finally {
      setSaving(false)
    }
  }

  async function handleRemoveFromStore(shopId: string) {
    if (!confirm('Remove this user from the store?')) {
      return
    }

    setSaving(true)
    setError('')
    try {
      const res = await fetch(`/api/org/users/${userId}/stores/${shopId}`, {
        method: 'DELETE',
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to remove from store')

      setSuccess('Removed from store successfully')
      await loadUser()
      setTimeout(() => setSuccess(''), 3000)
    } catch (e: any) {
      setError(e.message || 'Failed to remove from store')
    } finally {
      setSaving(false)
    }
  }

  if (!user) {
    return null
  }

  if (!userId) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-red-600">Invalid user context</div>
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

  if (!userData) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-red-600">User not found</div>
      </div>
    )
  }

  const availableShops = shops.filter(
    (s) => !userData.shops.some((us) => us.shopId === s.id)
  )

  return (
    <div className="max-w-4xl mx-auto py-8">
      <div className="mb-6">
        <Link
          href="/org/users"
          className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Users
        </Link>
        <h1 className="text-3xl font-bold mb-2 bg-gradient-to-r from-blue-600 to-orange-600 bg-clip-text text-transparent flex items-center gap-3">
          <User className="h-8 w-8 text-blue-600" />
          {userData.name}
        </h1>
        <p className="text-gray-600">User details and store assignments</p>
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
          {/* User Information */}
          <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900">User Information</h2>
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
                    Name <span className="text-red-500">*</span>
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

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    Email
                  </label>
                  <input
                    type="email"
                    value={userData.email}
                    disabled
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Email cannot be changed
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+923001234567"
                    disabled={saving}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all disabled:bg-gray-50 disabled:cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                    <CreditCard className="h-4 w-4" />
                    CNIC
                  </label>
                  <input
                    type="text"
                    value={formData.cnic}
                    onChange={(e) => setFormData({ ...formData, cnic: e.target.value })}
                    placeholder="13-digit CNIC"
                    disabled={saving}
                    maxLength={15}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all disabled:bg-gray-50 disabled:cursor-not-allowed"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Enter 13 digits (with or without dashes). Leave blank to remove.
                  </p>
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="isWhatsApp"
                    checked={formData.isWhatsApp}
                    onChange={(e) => setFormData({ ...formData, isWhatsApp: e.target.checked })}
                    disabled={saving}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 disabled:cursor-not-allowed"
                  />
                  <label htmlFor="isWhatsApp" className="ml-2 text-sm text-gray-700">
                    This phone number is on WhatsApp
                  </label>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Organization Role
                  </label>
                  <select
                    value={formData.orgRole || ''}
                    onChange={(e) => setFormData({ ...formData, orgRole: e.target.value || null })}
                    disabled={saving}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all disabled:bg-gray-50 disabled:cursor-not-allowed"
                  >
                    <option value="">No Org Role (Shop Only)</option>
                    <option value="ORG_ADMIN">Org Admin</option>
                  </select>
                  <p className="mt-1 text-xs text-gray-500">
                    Users can have shop roles without an organization role
                  </p>
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
                      loadUser()
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
                  <span className="text-sm font-medium text-gray-700">Name:</span>
                  <p className="text-gray-900">{userData.name}</p>
                </div>
                <div>
                  <span className="text-sm font-medium text-gray-700 flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    Email:
                  </span>
                  <p className="text-gray-900">{userData.email}</p>
                </div>
                <div>
                  <span className="text-sm font-medium text-gray-700 flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    Phone:
                  </span>
                  <p className={userData.phone ? 'text-gray-900' : 'text-gray-400'}>
                    {userData.phone || 'Not provided'}
                    {userData.phone && userData.isWhatsApp && (
                      <span className="ml-2 text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded">
                        WhatsApp
                      </span>
                    )}
                  </p>
                </div>
                <div>
                  <span className="text-sm font-medium text-gray-700 flex items-center gap-2">
                    <CreditCard className="h-4 w-4" />
                    CNIC:
                  </span>
                  <p className={userData.cnic ? 'text-gray-900' : 'text-gray-400'}>
                    {userData.cnic ? formatCNIC(userData.cnic) : 'Not provided'}
                  </p>
                </div>
                <div>
                  <span className="text-sm font-medium text-gray-700">Organization Role:</span>
                  <p className="text-gray-900">
                    {userData.orgRole ? (
                      <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-sm font-medium">
                        {userData.orgRole === 'ORG_ADMIN' ? 'Org Admin' : userData.orgRole}
                      </span>
                    ) : (
                      <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-sm font-medium">
                        No Org Role (Shop Only)
                      </span>
                    )}
                  </p>
                </div>
                <div>
                  <span className="text-sm font-medium text-gray-700">Created:</span>
                  <p className="text-gray-900">{new Date(userData.createdAt).toLocaleDateString()}</p>
                </div>
              </div>
            )}
          </div>

          {/* Store Assignments */}
          <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                <Store className="h-5 w-5" />
                Store Assignments
              </h2>
              {availableShops.length > 0 && (
                <button
                  onClick={() => setShowAssignForm(!showAssignForm)}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors duration-200 text-sm flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Assign Store
                </button>
              )}
            </div>

            {showAssignForm && (
              <div className="mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <select
                    value={assignData.shopId}
                    onChange={(e) => setAssignData({ ...assignData, shopId: e.target.value })}
                    disabled={saving}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all disabled:bg-gray-50 disabled:cursor-not-allowed"
                  >
                    <option value="">Select Store</option>
                    {availableShops.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                  <select
                    value={assignData.shopRole}
                    onChange={(e) => setAssignData({ ...assignData, shopRole: e.target.value })}
                    disabled={saving || !assignData.shopId}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all disabled:bg-gray-50 disabled:cursor-not-allowed"
                  >
                    <option value="STORE_MANAGER">Store Manager</option>
                    <option value="CASHIER">Cashier</option>
                  </select>
                  <div className="flex gap-2">
                    <button
                      onClick={handleAssignStore}
                      disabled={saving || !assignData.shopId}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Assign
                    </button>
                    <button
                      onClick={() => {
                        setShowAssignForm(false)
                        setAssignData({ shopId: '', shopRole: 'STORE_MANAGER' })
                      }}
                      disabled={saving}
                      className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}

            {userData.shops.length === 0 ? (
              <p className="text-gray-500">No store assignments</p>
            ) : (
              <div className="space-y-3">
                {userData.shops.map((assignment) => (
                  <div
                    key={assignment.shopId}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200"
                  >
                    <div>
                      <p className="font-medium text-gray-900">{assignment.shop.name}</p>
                      <p className="text-sm text-gray-600">
                        {assignment.shopRole === 'STORE_MANAGER' ? 'Store Manager' : assignment.shopRole}
                      </p>
                    </div>
                    <button
                      onClick={() => handleRemoveFromStore(assignment.shopId)}
                      disabled={saving}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Remove from store"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Info</h3>
            <div className="space-y-3">
              <div>
                <span className="text-sm text-gray-600">Total Stores:</span>
                <p className="font-semibold text-gray-900">{userData.shops.length}</p>
              </div>
              <div>
                <span className="text-sm text-gray-600">Role:</span>
                <p className="font-semibold text-gray-900">
                  {userData.orgRole ? (
                    userData.orgRole === 'ORG_ADMIN' ? 'Org Admin' : userData.orgRole
                  ) : (
                    'Shop Only'
                  )}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

