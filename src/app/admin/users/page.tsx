'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { format } from 'date-fns'
import { User, Mail, Phone, CreditCard, Shield, Building2, Store } from 'lucide-react'
import EmptyState from '@/components/ui/EmptyState'

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
        <p className="text-gray-600">Access denied.</p>
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
          <p className="text-gray-600">Manage user accounts and permissions</p>
        </div>
      </div>

      {/* Search */}
      <div className="mb-6">
        <input
          type="text"
          placeholder="Search by name, email, phone, or CNIC..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full max-w-md px-4 py-2 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-gray-600">Loading...</div>
      ) : filteredUsers.length === 0 ? (
        <EmptyState title="No users found" description="Platform users will appear here." />
      ) : (
        <>
        <div className="hidden overflow-x-auto sm:block">
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
                  Organizations
                </th>
                <th className="px-4 py-4 text-left text-sm font-semibold text-gray-700 uppercase tracking-wider border-b border-gray-200">
                  Shops
                </th>
                <th className="px-4 py-4 text-left text-sm font-semibold text-gray-700 uppercase tracking-wider border-b border-gray-200">
                  Created
                </th>
              </tr>
            </thead>
            <tbody className="bg-white">
              {filteredUsers.map((u) => (
                <tr
                  key={u.id}
                  className="hover:bg-gray-50 transition-colors border-b border-gray-100"
                >
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 to-orange-500 flex items-center justify-center flex-shrink-0">
                        <span className="text-white text-base font-semibold">
                          {u.name[0]?.toUpperCase() || 'U'}
                        </span>
                      </div>
                      <div>
                        <div className="font-semibold text-base text-gray-900">{u.name}</div>
                        <div className="text-sm text-gray-500 flex items-center gap-1 mt-1">
                          <Mail className="h-4 w-4" />
                          {u.email}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-base">
                    {u.phone && (
                      <div className="text-gray-700 flex items-center gap-1.5 mb-1.5">
                        <Phone className="h-4 w-4" />
                        <span>{u.phone}</span> {u.isWhatsApp && <span className="text-green-600 text-sm">(WA)</span>}
                      </div>
                    )}
                    {u.cnic && (
                      <div className="text-gray-700 flex items-center gap-1.5">
                        <CreditCard className="h-4 w-4" />
                        <span>{u.cnic}</span>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-4">
                    <span
                      className={`px-3 py-1.5 rounded-md text-sm font-semibold inline-flex items-center gap-1.5 ${
                        u.role === 'PLATFORM_ADMIN'
                          ? 'bg-purple-100 text-purple-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {u.role === 'PLATFORM_ADMIN' ? (
                        <>
                          <Shield className="h-4 w-4" />
                          Admin
                        </>
                      ) : (
                        'Normal'
                      )}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-base">
                    {u.organizations.length > 0 ? (
                      <div className="space-y-1.5">
                        {u.organizations.map((org) => (
                          <div
                            key={org.orgId}
                            className="flex items-center gap-1.5 text-gray-700"
                          >
                            <Building2 className="h-4 w-4" />
                            <span>{org.organization.name}</span>
                            <span className="text-sm text-gray-500">({org.orgRole})</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-4 py-4 text-base">
                    {u.shops.length > 0 ? (
                      <div className="space-y-1.5">
                        {u.shops.map((shop) => (
                          <div
                            key={shop.shopId}
                            className="flex items-center gap-1.5 text-gray-700"
                          >
                            <Store className="h-4 w-4" />
                            <span>{shop.shop.name}</span>
                            <span className="text-sm text-gray-500">({shop.shopRole})</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-4 py-4 text-base text-gray-500">
                    {format(new Date(u.createdAt), 'MMM d, yyyy')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="space-y-3 sm:hidden">
          {filteredUsers.map((u) => (
            <div key={u.id} className="rounded-lg border border-gray-200 bg-white p-4">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 to-orange-500 flex items-center justify-center flex-shrink-0">
                  <span className="text-white text-base font-semibold">{u.name[0]?.toUpperCase() || 'U'}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-gray-900 break-words">{u.name}</div>
                  <div className="text-sm text-gray-500 flex items-center gap-1 break-all">
                    <Mail className="h-4 w-4 flex-shrink-0" />
                    {u.email}
                  </div>
                </div>
                <span
                  className={`px-2 py-1 rounded-md text-xs font-semibold inline-flex items-center gap-1 flex-shrink-0 ${
                    u.role === 'PLATFORM_ADMIN' ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  {u.role === 'PLATFORM_ADMIN' ? (<><Shield className="h-3.5 w-3.5" />Admin</>) : 'Normal'}
                </span>
              </div>

              {(u.phone || u.cnic) && (
                <div className="mt-3 space-y-1 text-sm text-gray-700">
                  {u.phone && (
                    <div className="flex items-center gap-1.5">
                      <Phone className="h-4 w-4" />
                      <span>{u.phone}</span> {u.isWhatsApp && <span className="text-green-600 text-xs">(WA)</span>}
                    </div>
                  )}
                  {u.cnic && (
                    <div className="flex items-center gap-1.5">
                      <CreditCard className="h-4 w-4" />
                      <span>{u.cnic}</span>
                    </div>
                  )}
                </div>
              )}

              {u.organizations.length > 0 && (
                <div className="mt-3 space-y-1 text-sm text-gray-700">
                  {u.organizations.map((org) => (
                    <div key={org.orgId} className="flex items-center gap-1.5">
                      <Building2 className="h-4 w-4 flex-shrink-0" />
                      <span className="break-words">{org.organization.name}</span>
                      <span className="text-xs text-gray-500">({org.orgRole})</span>
                    </div>
                  ))}
                </div>
              )}

              {u.shops.length > 0 && (
                <div className="mt-2 space-y-1 text-sm text-gray-700">
                  {u.shops.map((shop) => (
                    <div key={shop.shopId} className="flex items-center gap-1.5">
                      <Store className="h-4 w-4 flex-shrink-0" />
                      <span className="break-words">{shop.shop.name}</span>
                      <span className="text-xs text-gray-500">({shop.shopRole})</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-3 text-xs text-gray-400">
                Joined {format(new Date(u.createdAt), 'MMM d, yyyy')}
              </div>
            </div>
          ))}
        </div>
        </>
      )}
    </div>
  )
}

