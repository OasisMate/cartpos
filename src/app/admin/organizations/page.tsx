'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'

interface Organization {
  id: string
  name: string
  status: 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'INACTIVE'
  createdAt: string
  approvedAt?: string | null
  _count: {
    shops: number
    users: number
  }
}

export default function OrganizationsPage() {
  const { user } = useAuth()
  const [orgs, setOrgs] = useState<Organization[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [approvingId, setApprovingId] = useState<string | null>(null)

  useEffect(() => {
    if (user?.role === 'PLATFORM_ADMIN') {
      fetchOrgs()
    }
  }, [user])

  async function fetchOrgs() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/admin/organizations')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load organizations')
      setOrgs(data.organizations || [])
    } catch (e: any) {
      setError(e.message || 'Failed to load')
    } finally {
      setLoading(false)
    }
  }

  async function approveOrg(id: string) {
    try {
      setApprovingId(id)
      const res = await fetch(`/api/admin/organizations/${id}/approve`, {
        method: 'POST',
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to approve')
      await fetchOrgs()
    } catch (e) {
      // noop
    } finally {
      setApprovingId(null)
    }
  }

  if (user?.role !== 'PLATFORM_ADMIN') {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-2">Organizations</h1>
        <p className="text-[hsl(var(--muted-foreground))]">Access denied.</p>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Organizations</h1>
          <p className="text-[hsl(var(--muted-foreground))]">Manage organizations and approvals</p>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-100 text-red-700 rounded">{error}</div>
      )}

      {loading ? (
        <div className="text-[hsl(var(--muted-foreground))]">Loading...</div>
      ) : orgs.length === 0 ? (
        <div className="text-[hsl(var(--muted-foreground))]">No organizations</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-[hsl(var(--border))]">
            <thead className="bg-[hsl(var(--muted))]">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wider">
                  Name
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wider">
                  Shops
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wider">
                  Users
                </th>
                <th className="px-4 py-2 text-right text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-[hsl(var(--card))] divide-y divide-[hsl(var(--border))]">
              {orgs.map((org) => (
                <tr key={org.id}>
                  <td className="px-4 py-2 text-sm">{org.name}</td>
                  <td className="px-4 py-2 text-sm">
                    <span className="px-2 py-1 rounded bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]">
                      {org.status}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-sm">{org._count.shops}</td>
                  <td className="px-4 py-2 text-sm">{org._count.users}</td>
                  <td className="px-4 py-2 text-sm text-right">
                    {org.status === 'PENDING' && (
                      <button
                        className="btn btn-primary h-8 px-3"
                        disabled={approvingId === org.id}
                        onClick={() => approveOrg(org.id)}
                      >
                        {approvingId === org.id ? 'Approving...' : 'Approve'}
                      </button>
                    )}
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


