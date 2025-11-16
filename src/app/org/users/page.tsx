'use client'

import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'

interface OrgUser {
  id: string
  name: string
  email: string
  platformRole: string
  orgRole: string
  shops: Array<{ shopId: string; shopRole: string; shop: { id: string; name: string } }>
}

export default function OrgUsersPage() {
  const { user } = useAuth()
  const [users, setUsers] = useState<OrgUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [orgRole, setOrgRole] = useState('ORG_ADMIN')
  const [assignShopId, setAssignShopId] = useState('')
  const [assignRole, setAssignRole] = useState('SHOP_OWNER')
  const [shops, setShops] = useState<Array<{ id: string; name: string }>>([])
  const [submitting, setSubmitting] = useState(false)

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
    if (!name || !email || !password) {
      setError('All fields are required')
      return
    }
    setSubmitting(true)
    try {
      const payload: any = { name, email, password, orgRole }
      if (assignShopId) {
        payload.assignments = [{ shopId: assignShopId, shopRole: assignRole }]
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
      setAssignShopId('')
      setAssignRole('SHOP_OWNER')
      setOrgRole('ORG_ADMIN')
      setShowForm(false)
      await load()
    } catch (e: any) {
      setError(e.message || 'Failed to create')
    } finally {
      setSubmitting(false)
    }
  }

  const sorted = useMemo(
    () => users.slice().sort((a, b) => a.name.localeCompare(b.name)),
    [users]
  )

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Organization Users</h1>
          <p className="text-[hsl(var(--muted-foreground))]">
            Manage users and assignments in this organization
          </p>
        </div>
        <button className="btn btn-primary h-9 px-4" onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'Cancel' : 'New User'}
        </button>
      </div>

      {showForm && (
        <div className="card mb-6">
          <div className="card-body">
            <h2 className="font-semibold mb-3">Create User</h2>
            {error && <div className="mb-3 p-3 bg-red-100 text-red-700 rounded">{error}</div>}
            <form onSubmit={onCreate} className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input
                className="input"
                placeholder="Full name *"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <input
                className="input"
                placeholder="Email *"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <input
                className="input"
                placeholder="Password *"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <select className="input" value={orgRole} onChange={(e) => setOrgRole(e.target.value)}>
                <option value="ORG_ADMIN">Org Admin</option>
              </select>
              <select
                className="input"
                value={assignShopId}
                onChange={(e) => setAssignShopId(e.target.value)}
              >
                <option value="">(Optional) Assign to Shop</option>
                {shops.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <select
                className="input"
                value={assignRole}
                onChange={(e) => setAssignRole(e.target.value)}
                disabled={!assignShopId}
              >
                <option value="SHOP_OWNER">Shop Owner</option>
                <option value="CASHIER">Cashier</option>
              </select>
              <div className="md:col-span-2 flex justify-end">
                <button className="btn btn-primary h-9 px-4" disabled={submitting}>
                  {submitting ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-[hsl(var(--muted-foreground))]">Loading...</div>
      ) : sorted.length === 0 ? (
        <div className="text-[hsl(var(--muted-foreground))]">No users yet.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-[hsl(var(--border))]">
            <thead className="bg-[hsl(var(--muted))]">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wider">
                  Name
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wider">
                  Email
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wider">
                  Org Role
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wider">
                  Shops
                </th>
              </tr>
            </thead>
            <tbody className="bg-[hsl(var(--card))] divide-y divide-[hsl(var(--border))]">
              {sorted.map((u) => (
                <tr key={u.id}>
                  <td className="px-4 py-2 text-sm">{u.name}</td>
                  <td className="px-4 py-2 text-sm">{u.email}</td>
                  <td className="px-4 py-2 text-sm">{u.orgRole}</td>
                  <td className="px-4 py-2 text-sm">
                    {u.shops.length === 0
                      ? '—'
                      : u.shops.map((s) => `${s.shop.name} (${s.shopRole})`).join(', ')}
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


