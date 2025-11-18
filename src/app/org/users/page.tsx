'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { UserPlus, Edit, Trash2, Mail, Eye, EyeOff, Phone, Fingerprint } from 'lucide-react'

interface OrgUser {
  id: string
  name: string
  email: string
  phone?: string | null
  cnic?: string | null
  orgRole: string
  shops: Array<{ shopId: string; shopRole: string; shop: { id: string; name: string } }>
}

export default function OrgUsersPage() {
  const router = useRouter()
  const { user } = useAuth()
  const [users, setUsers] = useState<OrgUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [cnic, setCnic] = useState('')
  const [password, setPassword] = useState('')
  const [userRole, setUserRole] = useState<'ORG_ADMIN' | 'STORE_MANAGER' | 'CASHIER' | ''>('')
  const [assignShopId, setAssignShopId] = useState('')
  const [shops, setShops] = useState<Array<{ id: string; name: string }>>([])
  const [submitting, setSubmitting] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)

  useEffect(() => {
    if (user) {
      load()
      fetchShops()
    }
  }, [user])

  async function load() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/org/users')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load users')
      setUsers(data.users || [])
    } catch (e: any) {
      setError(e.message || 'Failed to load')
    } finally {
      setLoading(false)
    }
  }

  async function fetchShops() {
    const res = await fetch('/api/org/shops')
    const data = await res.json()
    if (res.ok) {
      setShops((data.shops || []).map((s: any) => ({ id: s.id, name: s.name })))
    }
  }

  async function onCreate(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!name || !email || !password || !userRole) {
      setError('All fields are required')
      return
    }
    
    // If Store Manager or Cashier, store is required
    if ((userRole === 'STORE_MANAGER' || userRole === 'CASHIER') && !assignShopId) {
      setError('Store selection is required for Store Manager and Cashier roles')
      return
    }
    
    setSubmitting(true)
    try {
      const payload: any = { name, email, password }
      const trimmedPhone = phone.trim()
      const trimmedCnic = cnic.trim()
      
      if (trimmedPhone) {
        payload.phone = trimmedPhone
      }
      if (trimmedCnic) {
        payload.cnic = trimmedCnic
      }
      
      if (userRole === 'ORG_ADMIN') {
        payload.orgRole = 'ORG_ADMIN'
      } else if (userRole === 'STORE_MANAGER' || userRole === 'CASHIER') {
        // For store roles, assign to the selected store
        payload.assignments = [{ shopId: assignShopId, shopRole: userRole }]
      }
      const res = await fetch('/api/org/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to create user')
      setName('')
      setEmail('')
      setPassword('')
      setPhone('')
      setCnic('')
      setUserRole('')
      setAssignShopId('')
      setShowForm(false)
      setSuccess('User created successfully')
      // Optimistically refresh the list
      load().catch(() => {}) // Fire and forget for speed
      setTimeout(() => setSuccess(''), 3000)
    } catch (e: any) {
      setError(e.message || 'Failed to create')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(userId: string) {
    if (!confirm('Are you sure you want to remove this user from the organization? This will remove all their store assignments.')) {
      return
    }

    setDeletingId(userId)
    setError('')
    try {
      const res = await fetch(`/api/org/users/${userId}`, {
        method: 'DELETE',
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to remove user')
      setSuccess('User removed successfully')
      await load()
      setTimeout(() => setSuccess(''), 3000)
    } catch (e: any) {
      setError(e.message || 'Failed to remove user')
    } finally {
      setDeletingId(null)
    }
  }

  const sorted = useMemo(
    () => users
      .filter((u) => u.id !== user?.id) // Filter out the current Org Admin
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name)),
    [users, user?.id]
  )

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold mb-2 bg-gradient-to-r from-blue-600 to-orange-600 bg-clip-text text-transparent">
            Users Management
          </h1>
          <p className="text-gray-600">
            Manage users and their store assignments in this organization
          </p>
        </div>
        {!showForm && (
          <button
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors duration-200 flex items-center gap-2"
            onClick={() => setShowForm(true)}
          >
            <UserPlus className="h-4 w-4" />
            New User
          </button>
        )}
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

      {showForm && (
        <div className="flex justify-center mb-6">
          <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6 w-full max-w-lg">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900">Create User</h2>
              <button
                onClick={() => {
                  setShowForm(false)
                  // Clear form state
                  setName('')
                  setEmail('')
                  setPhone('')
                  setCnic('')
                  setPassword('')
                  setUserRole('')
                  setAssignShopId('')
                  setError('')
                  setShowPassword(false)
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                ✕
              </button>
            </div>
            <form onSubmit={onCreate} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Full Name <span className="text-red-500">*</span>
              </label>
              <input
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                placeholder="Enter full name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email <span className="text-red-500">*</span>
              </label>
              <input
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                placeholder="Enter email address"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Phone Number
              </label>
              <input
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                placeholder="03xx-xxxxxxx"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
              <p className="text-xs text-gray-500 mt-1">Optional but recommended. Used for login & recovery.</p>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                CNIC
              </label>
              <input
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                placeholder="13-digit CNIC (with or without dashes)"
                value={cnic}
                onChange={(e) => setCnic(e.target.value)}
                maxLength={15}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Password <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  className="w-full px-4 py-2.5 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                  placeholder="Minimum 6 characters"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Role <span className="text-red-500">*</span>
              </label>
              <select
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all bg-white"
                value={userRole}
                onChange={(e) => {
                  const role = e.target.value as 'ORG_ADMIN' | 'STORE_MANAGER' | 'CASHIER' | ''
                  setUserRole(role)
                  if (role === 'ORG_ADMIN') {
                    setAssignShopId('')
                  }
                }}
                required
              >
                <option value="">Select role</option>
                <option value="ORG_ADMIN">Organization Admin</option>
                <option value="STORE_MANAGER">Store Manager</option>
                <option value="CASHIER">Cashier</option>
              </select>
            </div>

            {(userRole === 'STORE_MANAGER' || userRole === 'CASHIER') && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Store <span className="text-red-500">*</span>
                </label>
                <select
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all bg-white"
                  value={assignShopId}
                  onChange={(e) => setAssignShopId(e.target.value)}
                  required
                >
                  <option value="">Select store</option>
                  {shops.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowForm(false)
                  // Clear form state
                  setName('')
                  setEmail('')
                  setPassword('')
                  setUserRole('')
                  setAssignShopId('')
                  setError('')
                  setShowPassword(false)
                }}
                className="px-5 py-2.5 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={submitting}
              >
                {submitting ? 'Creating...' : 'Create User'}
              </button>
            </div>
          </form>
          </div>
        </div>
      )}

      {!showForm && (
        <>
          {loading ? (
            <div className="text-gray-600">Loading...</div>
          ) : sorted.length === 0 ? (
            <div className="bg-white rounded-xl shadow-md border border-gray-200 p-8 text-center">
              <p className="text-gray-600 mb-4">No users yet.</p>
              <button
                onClick={() => setShowForm(true)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors duration-200"
              >
                Create First User
              </button>
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse">
              <thead className="bg-gradient-to-r from-blue-50 to-orange-50">
                <tr>
                  <th className="px-4 py-4 text-left text-sm font-semibold text-gray-700 uppercase tracking-wider border-b border-gray-200">
                    User
                  </th>
                  <th className="px-4 py-4 text-left text-sm font-semibold text-gray-700 uppercase tracking-wider border-b border-gray-200">
                    Contact
                  </th>
                  <th className="px-4 py-4 text-left text-sm font-semibold text-gray-700 uppercase tracking-wider border-b border-gray-200">
                    Role
                  </th>
                  <th className="px-4 py-4 text-left text-sm font-semibold text-gray-700 uppercase tracking-wider border-b border-gray-200">
                    Store Assignments
                  </th>
                  <th className="px-4 py-4 text-right text-sm font-semibold text-gray-700 uppercase tracking-wider border-b border-gray-200">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white">
                {sorted.map((u) => (
                  <tr
                    key={u.id}
                    className="hover:bg-gray-50 transition-colors border-b border-gray-100"
                  >
                    <td className="px-4 py-4">
                      <div className="font-semibold text-base text-gray-900">{u.name}</div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="text-gray-700 flex items-center gap-1.5 mb-1">
                        <Mail className="h-4 w-4" />
                        <span className="text-base">{u.email}</span>
                      </div>
                      {u.phone ? (
                        <div className="text-gray-600 flex items-center gap-1.5 text-sm">
                          <Phone className="h-4 w-4" />
                          <span>{u.phone}</span>
                        </div>
                      ) : (
                        <div className="text-gray-400 text-sm flex items-center gap-1.5">
                          <Phone className="h-4 w-4" />
                          <span>No phone</span>
                        </div>
                      )}
                      {u.cnic ? (
                        <div className="text-gray-600 flex items-center gap-1.5 text-sm">
                          <Fingerprint className="h-4 w-4" />
                          <span>{u.cnic}</span>
                        </div>
                      ) : (
                        <div className="text-gray-400 text-sm flex items-center gap-1.5">
                          <Fingerprint className="h-4 w-4" />
                          <span>No CNIC</span>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-sm font-medium">
                        {u.orgRole === 'ORG_ADMIN' ? 'Organization Admin' : u.orgRole || 'No Role'}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-base">
                      {u.shops.length === 0 ? (
                        <span className="text-gray-400">No assignments</span>
                      ) : (
                        <div className="space-y-1">
                          {u.shops.map((s) => (
                            <div key={s.shopId} className="text-gray-700">
                              <span className="font-medium">{s.shop.name}</span>
                              <span className="text-sm text-gray-500 ml-2">
                                ({s.shopRole === 'STORE_MANAGER' ? 'Store Manager' : s.shopRole === 'CASHIER' ? 'Cashier' : s.shopRole})
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => {
                            router.push(`/org/users/${u.id}`)
                          }}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors duration-200"
                          title="Edit User"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(u.id)}
                          disabled={deletingId === u.id || u.id === user?.id}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Remove User"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
          )}
        </>
      )}
    </div>
  )
}


