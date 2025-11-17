'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { format } from 'date-fns'
import { User, Mail, Phone, CreditCard, Shield, Building2, Store } from 'lucide-react'

interface AdminUser {
  id: string
  name: string
  email: string
  phone: string | null
  cnic: string | null
  isWhatsApp: boolean
  role: 'PLATFORM_ADMIN' | 'NORMAL'
  createdAt: string
  organizations: Array<{
    orgId: string
    orgRole: string
    organization: {
      id: string
      name: string
      status: string
    }
  }>
  shops: Array<{
    shopId: string
    shopRole: string
    shop: {
      id: string
      name: string
    }
  }>
}

export default function UsersPage() {
  const { user } = useAuth()
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    if (user?.role === 'PLATFORM_ADMIN') {
      fetchUsers()
    }
  }, [user])

  async function fetchUsers() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/admin/users')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load users')

      setUsers(data.users || [])
    } catch (e: any) {
      setError(e.message || 'Failed to load')
    } finally {
      setLoading(false)
    }
  }

  if (user?.role !== 'PLATFORM_ADMIN') {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-2">Users</h1>
        <p className="text-gray-600 dark:text-gray-400">Access denied.</p>
      </div>
    )
  }

  const filteredUsers = users.filter(
    (u) =>
      u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.phone && u.phone.includes(searchTerm)) ||
      (u.cnic && u.cnic.includes(searchTerm))
  )

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold mb-2 bg-gradient-to-r from-blue-600 to-orange-600 bg-clip-text text-transparent">
            Users Management
          </h1>
          <p className="text-gray-600 dark:text-gray-400">Manage user accounts and permissions</p>
        </div>
      </div>

      {/* Search */}
      <div className="mb-6">
        <input
          type="text"
          placeholder="Search by name, email, phone, or CNIC..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full max-w-md px-4 py-2 border border-gray-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-lg">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-gray-600 dark:text-gray-400">Loading...</div>
      ) : filteredUsers.length === 0 ? (
        <div className="text-gray-600 dark:text-gray-400">No users found.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-neutral-700">
            <thead className="bg-gradient-to-r from-blue-50 to-orange-50 dark:from-neutral-800 dark:to-neutral-800">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                  User
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                  Contact
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                  Role
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                  Organizations
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                  Shops
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                  Created
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-neutral-900 divide-y divide-gray-200 dark:divide-neutral-700">
              {filteredUsers.map((u) => (
                <tr
                  key={u.id}
                  className="hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 to-orange-500 flex items-center justify-center flex-shrink-0">
                        <span className="text-white text-sm font-semibold">
                          {u.name[0]?.toUpperCase() || 'U'}
                        </span>
                      </div>
                      <div>
                        <div className="font-medium text-gray-900 dark:text-gray-100">{u.name}</div>
                        <div className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          {u.email}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {u.phone && (
                      <div className="text-gray-700 dark:text-gray-300 flex items-center gap-1 mb-1">
                        <Phone className="h-3 w-3" />
                        {u.phone} {u.isWhatsApp && <span className="text-green-600">(WA)</span>}
                      </div>
                    )}
                    {u.cnic && (
                      <div className="text-gray-700 dark:text-gray-300 flex items-center gap-1">
                        <CreditCard className="h-3 w-3" />
                        {u.cnic}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-1 rounded text-xs font-semibold ${
                        u.role === 'PLATFORM_ADMIN'
                          ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400'
                          : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'
                      }`}
                    >
                      {u.role === 'PLATFORM_ADMIN' ? (
                        <span className="flex items-center gap-1">
                          <Shield className="h-3 w-3" />
                          Admin
                        </span>
                      ) : (
                        'Normal'
                      )}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {u.organizations.length > 0 ? (
                      <div className="space-y-1">
                        {u.organizations.map((org) => (
                          <div
                            key={org.orgId}
                            className="flex items-center gap-1 text-gray-700 dark:text-gray-300"
                          >
                            <Building2 className="h-3 w-3" />
                            <span>{org.organization.name}</span>
                            <span className="text-xs text-gray-500">({org.orgRole})</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {u.shops.length > 0 ? (
                      <div className="space-y-1">
                        {u.shops.map((shop) => (
                          <div
                            key={shop.shopId}
                            className="flex items-center gap-1 text-gray-700 dark:text-gray-300"
                          >
                            <Store className="h-3 w-3" />
                            <span>{shop.shop.name}</span>
                            <span className="text-xs text-gray-500">({shop.shopRole})</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                    {format(new Date(u.createdAt), 'MMM d, yyyy')}
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

