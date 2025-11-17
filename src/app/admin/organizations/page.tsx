'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { formatCNIC } from '@/lib/validation'

function formatOrganizationType(type: string): string {
  return type
    .split('_')
    .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
    .join(' ')
}

interface RequestedByUser {
  id: string
  name: string
  email: string
  phone: string | null
  cnic: string | null
  isWhatsApp: boolean
}

interface Organization {
  id: string
  name: string
  legalName: string | null
  type: string
  phone: string | null
  city: string | null
  addressLine1: string | null
  addressLine2: string | null
  ntn: string | null
  strn: string | null
  status: 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'INACTIVE'
  createdAt: string
  approvedAt?: string | null
  rejectionReason?: string | null
  suspensionReason?: string | null
  requestedByUser: RequestedByUser | null
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
  const [actioningId, setActioningId] = useState<string | null>(null)
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null)
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [showSuspendModal, setShowSuspendModal] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [suspendReason, setSuspendReason] = useState('')
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'INACTIVE'>('ALL')

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
      setActioningId(id)
      const res = await fetch(`/api/admin/organizations/${id}/approve`, {
        method: 'POST',
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to approve')
      await fetchOrgs()
    } catch (e: any) {
      setError(e.message || 'Failed to approve')
    } finally {
      setActioningId(null)
    }
  }

  async function rejectOrg(id: string, reason?: string) {
    try {
      setActioningId(id)
      const res = await fetch(`/api/admin/organizations/${id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to reject')
      setShowRejectModal(false)
      setRejectReason('')
      setSelectedOrg(null)
      await fetchOrgs()
    } catch (e: any) {
      setError(e.message || 'Failed to reject')
    } finally {
      setActioningId(null)
    }
  }

  async function suspendOrg(id: string, reason?: string) {
    try {
      setActioningId(id)
      const res = await fetch(`/api/admin/organizations/${id}/suspend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to suspend')
      setShowSuspendModal(false)
      setSuspendReason('')
      setSelectedOrg(null)
      await fetchOrgs()
    } catch (e: any) {
      setError(e.message || 'Failed to suspend')
    } finally {
      setActioningId(null)
    }
  }

  async function reactivateOrg(id: string) {
    try {
      setActioningId(id)
      const res = await fetch(`/api/admin/organizations/${id}/reactivate`, {
        method: 'POST',
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to reactivate')
      await fetchOrgs()
    } catch (e: any) {
      setError(e.message || 'Failed to reactivate')
    } finally {
      setActioningId(null)
    }
  }

  const filteredOrgs = orgs.filter((org) => statusFilter === 'ALL' || org.status === statusFilter)

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
          <h1 className="text-3xl font-bold mb-2 bg-gradient-to-r from-blue-600 to-orange-600 bg-clip-text text-transparent">
            Organizations Management
          </h1>
          <p className="text-gray-600">Manage organizations and approvals</p>
        </div>
        <div className="flex items-center gap-4">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="px-3 py-2 border border-gray-300 rounded-md bg-white"
          >
            <option value="ALL">All Status</option>
            <option value="PENDING">Pending</option>
            <option value="ACTIVE">Active</option>
            <option value="SUSPENDED">Suspended</option>
            <option value="INACTIVE">Inactive</option>
          </select>
        </div>
      </div>

      {error && <div className="mb-4 p-3 bg-red-100 text-red-700 rounded">{error}</div>}

      {loading ? (
        <div className="text-[hsl(var(--muted-foreground))]">Loading...</div>
      ) : filteredOrgs.length === 0 ? (
        <div className="text-[hsl(var(--muted-foreground))]">No organizations found</div>
      ) : (
        <div className="space-y-4">
          {filteredOrgs.map((org) => (
            <div key={org.id} className="bg-white border border-gray-200 rounded-lg p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold">{org.name}</h3>
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium ${
                        org.status === 'ACTIVE'
                          ? 'bg-green-100 text-green-800'
                          : org.status === 'PENDING'
                          ? 'bg-yellow-100 text-yellow-800'
                          : org.status === 'SUSPENDED'
                          ? 'bg-orange-100 text-orange-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {org.status}
                    </span>
                  </div>
                  {org.legalName && org.legalName !== org.name && (
                    <p className="text-sm text-gray-600">Legal Name: {org.legalName}</p>
                  )}
                  <p className="text-sm text-gray-600">
                    Type: <span className="font-medium">{formatOrganizationType(org.type)}</span>
                  </p>
                </div>
                <div className="flex gap-2">
                  {org.status === 'PENDING' && (
                    <>
                      <button
                        className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700 disabled:opacity-50"
                        disabled={actioningId === org.id}
                        onClick={() => approveOrg(org.id)}
                      >
                        {actioningId === org.id ? 'Approving...' : 'Approve'}
                      </button>
                      <button
                        className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700 disabled:opacity-50"
                        disabled={actioningId === org.id}
                        onClick={() => {
                          setSelectedOrg(org)
                          setShowRejectModal(true)
                        }}
                      >
                        Reject
                      </button>
                    </>
                  )}
                  {org.status === 'ACTIVE' && (
                    <button
                      className="px-3 py-1 bg-orange-600 text-white rounded text-sm hover:bg-orange-700 disabled:opacity-50"
                      disabled={actioningId === org.id}
                      onClick={() => {
                        setSelectedOrg(org)
                        setShowSuspendModal(true)
                      }}
                    >
                      Suspend
                    </button>
                  )}
                  {org.status === 'SUSPENDED' && (
                    <button
                      className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700 disabled:opacity-50"
                      disabled={actioningId === org.id}
                      onClick={() => reactivateOrg(org.id)}
                    >
                      {actioningId === org.id ? 'Reactivating...' : 'Reactivate'}
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 mb-2">Organization Details</h4>
                  <div className="space-y-1 text-sm text-gray-600">
                    <p>
                      <span className="font-medium">City:</span> {org.city || 'N/A'}
                    </p>
                    {org.phone && (
                      <p>
                        <span className="font-medium">Phone:</span> {org.phone}
                      </p>
                    )}
                    {org.addressLine1 && (
                      <p>
                        <span className="font-medium">Address:</span> {org.addressLine1}
                        {org.addressLine2 && `, ${org.addressLine2}`}
                      </p>
                    )}
                    {org.ntn && (
                      <p>
                        <span className="font-medium">NTN:</span> {org.ntn}
                      </p>
                    )}
                    {org.strn && (
                      <p>
                        <span className="font-medium">STRN:</span> {org.strn}
                      </p>
                    )}
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-semibold text-gray-700 mb-2">Contact Person</h4>
                  {org.requestedByUser ? (
                    <div className="space-y-1 text-sm text-gray-600">
                      <p>
                        <span className="font-medium">Name:</span> {org.requestedByUser.name}
                      </p>
                      <p>
                        <span className="font-medium">Email:</span> {org.requestedByUser.email}
                      </p>
                      {org.requestedByUser.phone && (
                        <p>
                          <span className="font-medium">Phone:</span> {org.requestedByUser.phone}
                          {org.requestedByUser.isWhatsApp && (
                            <span className="ml-2 text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded">
                              WhatsApp
                            </span>
                          )}
                        </p>
                      )}
                      {org.requestedByUser.cnic && (
                        <p>
                          <span className="font-medium">CNIC:</span> {formatCNIC(org.requestedByUser.cnic)}
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">No contact information</p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-4 text-sm text-gray-600 border-t pt-3">
                <span>
                  <span className="font-medium">Shops:</span> {org._count.shops}
                </span>
                <span>
                  <span className="font-medium">Users:</span> {org._count.users}
                </span>
                <span>
                  <span className="font-medium">Created:</span> {new Date(org.createdAt).toLocaleDateString()}
                </span>
                {org.approvedAt && (
                  <span>
                    <span className="font-medium">Approved:</span> {new Date(org.approvedAt).toLocaleDateString()}
                  </span>
                )}
              </div>

              {(org.rejectionReason || org.suspensionReason) && (
                <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded">
                  <p className="text-sm font-medium text-red-800">
                    {org.rejectionReason ? 'Rejection Reason:' : 'Suspension Reason:'}
                  </p>
                  <p className="text-sm text-red-700">{org.rejectionReason || org.suspensionReason}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && selectedOrg && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Reject Organization</h3>
            <p className="text-sm text-gray-600 mb-4">
              Are you sure you want to reject &quot;{selectedOrg.name}&quot;?
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Rejection Reason (Optional)
              </label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                rows={3}
                placeholder="Enter reason for rejection..."
              />
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowRejectModal(false)
                  setRejectReason('')
                  setSelectedOrg(null)
                }}
                className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => rejectOrg(selectedOrg.id, rejectReason || undefined)}
                disabled={actioningId === selectedOrg.id}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
              >
                {actioningId === selectedOrg.id ? 'Rejecting...' : 'Reject'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Suspend Modal */}
      {showSuspendModal && selectedOrg && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Suspend Organization</h3>
            <p className="text-sm text-gray-600 mb-4">
              Are you sure you want to suspend &quot;{selectedOrg.name}&quot;?
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Suspension Reason (Optional)
              </label>
              <textarea
                value={suspendReason}
                onChange={(e) => setSuspendReason(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                rows={3}
                placeholder="Enter reason for suspension..."
              />
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowSuspendModal(false)
                  setSuspendReason('')
                  setSelectedOrg(null)
                }}
                className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => suspendOrg(selectedOrg.id, suspendReason || undefined)}
                disabled={actioningId === selectedOrg.id}
                className="px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 disabled:opacity-50"
              >
                {actioningId === selectedOrg.id ? 'Suspending...' : 'Suspend'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
