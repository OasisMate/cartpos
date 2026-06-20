'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
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
  emailVerified: boolean
  createdAt: string
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
  deletionScheduledAt?: string | null
  requestedByUser: RequestedByUser | null
  _count: {
    shops: number
    users: number
  }
}

export default function OrganizationsPage() {
  const router = useRouter()
  const { user, refreshUser } = useAuth()
  const [orgs, setOrgs] = useState<Organization[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [actioningId, setActioningId] = useState<string | null>(null)
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null)
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [showSuspendModal, setShowSuspendModal] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [suspendReason, setSuspendReason] = useState('')
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'INACTIVE'>('ALL')
  const [enteringOrgId, setEnteringOrgId] = useState<string | null>(null)
  // Safe-deletion state
  const [showPurgeModal, setShowPurgeModal] = useState(false)
  const [purgeOrgData, setPurgeOrgData] = useState<Organization | null>(null)
  const [purgePreview, setPurgePreview] = useState<any>(null)
  const [purgeConfirmName, setPurgeConfirmName] = useState('')
  const [purgeDeleteOwner, setPurgeDeleteOwner] = useState(true)
  const [purgeDeleteStaff, setPurgeDeleteStaff] = useState(true)
  const [purging, setPurging] = useState(false)
  const [purgeError, setPurgeError] = useState('')
  const DELETION_BUFFER_DAYS = 7
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')
  const emptyCreateForm = {
    organizationName: '', organizationType: 'GENERAL_STORE', city: '',
    ownerName: '', ownerEmail: '', ownerPassword: '', ownerPhone: '',
  }
  const [createForm, setCreateForm] = useState(emptyCreateForm)

  async function createOrg() {
    setCreating(true)
    setCreateError('')
    try {
      const res = await fetch('/api/admin/organizations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createForm),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to create organization')
      setShowCreateModal(false)
      setCreateForm(emptyCreateForm)
      await fetchOrgs()
    } catch (e: any) {
      setCreateError(e.message || 'Failed to create organization')
    } finally {
      setCreating(false)
    }
  }

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

  async function scheduleDeletion(id: string) {
    try {
      setActioningId(id)
      const res = await fetch(`/api/admin/organizations/${id}/schedule-deletion`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to schedule deletion')
      await fetchOrgs()
    } catch (e: any) {
      setError(e.message || 'Failed to schedule deletion')
    } finally {
      setActioningId(null)
    }
  }

  async function cancelDeletion(id: string) {
    try {
      setActioningId(id)
      const res = await fetch(`/api/admin/organizations/${id}/cancel-deletion`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to cancel deletion')
      await fetchOrgs()
    } catch (e: any) {
      setError(e.message || 'Failed to cancel deletion')
    } finally {
      setActioningId(null)
    }
  }

  async function openPurge(org: Organization) {
    setPurgeOrgData(org)
    setPurgeConfirmName('')
    setPurgeDeleteOwner(true)
    setPurgeDeleteStaff(true)
    setPurgeError('')
    setPurgePreview(null)
    setShowPurgeModal(true)
    try {
      const res = await fetch(`/api/admin/organizations/${org.id}/deletion-preview`)
      const data = await res.json()
      if (res.ok) setPurgePreview(data.preview)
    } catch {
      /* preview is best-effort */
    }
  }

  async function confirmPurge() {
    if (!purgeOrgData) return
    setPurging(true)
    setPurgeError('')
    try {
      const res = await fetch(`/api/admin/organizations/${purgeOrgData.id}/purge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          confirmName: purgeConfirmName,
          deleteOwner: purgeDeleteOwner,
          deleteStaff: purgeDeleteStaff,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to delete organization')
      setShowPurgeModal(false)
      setPurgeOrgData(null)
      await fetchOrgs()
    } catch (e: any) {
      setPurgeError(e.message || 'Failed to delete organization')
    } finally {
      setPurging(false)
    }
  }

  // Days since the requesting user signed up, if they're still unverified.
  function unverifiedDays(org: Organization): number | null {
    const u = org.requestedByUser
    if (!u || u.emailVerified) return null
    return Math.floor((Date.now() - new Date(u.createdAt).getTime()) / (24 * 60 * 60 * 1000))
  }

  async function sendReminder(id: string) {
    try {
      setActioningId(id)
      setError('')
      setNotice('')
      const res = await fetch(`/api/admin/organizations/${id}/send-verification-reminder`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to send reminder')
      setNotice('Verification reminder email sent.')
    } catch (e: any) {
      setError(e.message || 'Failed to send reminder')
    } finally {
      setActioningId(null)
    }
  }

  async function deleteUnverified(org: Organization) {
    if (
      !window.confirm(
        `Permanently delete the unverified signup "${org.name}" (and its owner account)? This cannot be undone.`
      )
    )
      return
    try {
      setActioningId(org.id)
      setError('')
      setNotice('')
      const res = await fetch(`/api/admin/organizations/${org.id}/delete-unverified`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to delete')
      setNotice(`Deleted unverified signup "${org.name}".`)
      await fetchOrgs()
    } catch (e: any) {
      setError(e.message || 'Failed to delete')
    } finally {
      setActioningId(null)
    }
  }

  // Whether a scheduled org's buffer has elapsed (purge allowed).
  function purgeEligibleDate(org: Organization): Date | null {
    if (!org.deletionScheduledAt) return null
    return new Date(new Date(org.deletionScheduledAt).getTime() + DELETION_BUFFER_DAYS * 24 * 60 * 60 * 1000)
  }

  async function enterOrg(orgId: string) {
    try {
      setEnteringOrgId(orgId)
      setError('')
      
      // Call org select API
      const res = await fetch('/api/org/select', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to enter organization')
      }

      // Refresh user context to get updated cookie
      await refreshUser()
      
      // Navigate to org dashboard with explicit orgId (client-side navigation, no reload)
      router.push(`/org/${orgId}`)
    } catch (e: any) {
      setError(e.message || 'Failed to enter organization')
      setEnteringOrgId(null)
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
      <div className="flex flex-col gap-4 mb-6 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold mb-2 bg-gradient-to-r from-blue-600 to-orange-600 bg-clip-text text-transparent">
            Organizations Management
          </h1>
          <p className="text-gray-600">Manage organizations and approvals</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="w-full sm:w-auto px-3 py-2 border border-gray-300 rounded-md bg-white"
          >
            <option value="ALL">All Status</option>
            <option value="PENDING">Pending</option>
            <option value="ACTIVE">Active</option>
            <option value="SUSPENDED">Suspended</option>
            <option value="INACTIVE">Inactive</option>
          </select>
          <button
            onClick={() => { setCreateError(''); setShowCreateModal(true) }}
            className="w-full sm:w-auto whitespace-nowrap px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-md transition-colors"
          >
            + Create Organization
          </button>
        </div>
      </div>

      {error && <div className="mb-4 p-3 bg-red-100 text-red-700 rounded">{error}</div>}
      {notice && <div className="mb-4 p-3 bg-green-100 text-green-700 rounded">{notice}</div>}

      {loading ? (
        <div className="text-[hsl(var(--muted-foreground))]">Loading...</div>
      ) : filteredOrgs.length === 0 ? (
        <div className="text-[hsl(var(--muted-foreground))]">No organizations found</div>
      ) : (
        <div className="space-y-4">
          {filteredOrgs.map((org) => (
            <div key={org.id} className="bg-white border border-gray-200 rounded-lg p-6">
              <div className="flex flex-col gap-3 mb-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex-1 min-w-0">
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
                    {org.requestedByUser && !org.requestedByUser.emailVerified && (
                      <span className="px-2 py-1 rounded text-xs font-medium bg-red-100 text-red-800">
                        Email not verified
                      </span>
                    )}
                    {(() => {
                      const d = unverifiedDays(org)
                      return d !== null && d >= 7 ? (
                        <span className="px-2 py-1 rounded text-xs font-medium bg-amber-100 text-amber-800">
                          Overdue · {d}d unverified
                        </span>
                      ) : null
                    })()}
                  </div>
                  {org.legalName && org.legalName !== org.name && (
                    <p className="text-sm text-gray-600">Legal Name: {org.legalName}</p>
                  )}
                  <p className="text-sm text-gray-600">
                    Type: <span className="font-medium">{formatOrganizationType(org.type)}</span>
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 sm:justify-end">
                  {org.status === 'ACTIVE' && (
                    <button
                      className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50"
                      disabled={enteringOrgId === org.id || actioningId === org.id}
                      onClick={() => enterOrg(org.id)}
                    >
                      {enteringOrgId === org.id ? 'Entering...' : 'Enter Org'}
                    </button>
                  )}
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
                  {org.requestedByUser && !org.requestedByUser.emailVerified && (
                    <>
                      <button
                        className="px-3 py-1 border border-orange-300 text-orange-700 rounded text-sm hover:bg-orange-50 disabled:opacity-50"
                        disabled={actioningId === org.id}
                        onClick={() => sendReminder(org.id)}
                        title="Email the user a fresh verification link with the 7-day warning"
                      >
                        {actioningId === org.id ? 'Sending...' : 'Send reminder'}
                      </button>
                      <button
                        className="px-3 py-1 border border-red-300 text-red-700 rounded text-sm hover:bg-red-50 disabled:opacity-50"
                        disabled={actioningId === org.id}
                        onClick={() => deleteUnverified(org)}
                        title="Permanently delete this unverified signup and its owner account"
                      >
                        Delete
                      </button>
                    </>
                  )}
                  {org.status === 'ACTIVE' && (
                    <button
                      className="px-3 py-1 bg-orange-600 text-white rounded text-sm hover:bg-orange-700 disabled:opacity-50"
                      disabled={actioningId === org.id || enteringOrgId === org.id}
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
                  {/* Accept a previously-rejected request */}
                  {org.status === 'INACTIVE' && (
                    <button
                      className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700 disabled:opacity-50"
                      disabled={actioningId === org.id}
                      onClick={() => approveOrg(org.id)}
                    >
                      {actioningId === org.id ? 'Approving...' : 'Approve'}
                    </button>
                  )}
                  {/* Safe deletion controls (rejected or suspended only) */}
                  {(org.status === 'INACTIVE' || org.status === 'SUSPENDED') &&
                    (org.deletionScheduledAt ? (
                      <>
                        <button
                          className="px-3 py-1 border border-gray-300 rounded text-sm hover:bg-gray-50 disabled:opacity-50"
                          disabled={actioningId === org.id}
                          onClick={() => cancelDeletion(org.id)}
                        >
                          Cancel deletion
                        </button>
                        {(() => {
                          const due = purgeEligibleDate(org)
                          return due && new Date() >= due ? (
                            <button
                              className="px-3 py-1 bg-red-700 text-white rounded text-sm hover:bg-red-800"
                              onClick={() => openPurge(org)}
                            >
                              Delete permanently
                            </button>
                          ) : (
                            <span className="px-2 text-xs text-gray-500 self-center whitespace-nowrap">
                              Deletable {due?.toLocaleDateString()}
                            </span>
                          )
                        })()}
                      </>
                    ) : (
                      <button
                        className="px-3 py-1 border border-red-300 text-red-700 rounded text-sm hover:bg-red-50 disabled:opacity-50"
                        disabled={actioningId === org.id}
                        onClick={() => scheduleDeletion(org.id)}
                      >
                        Schedule deletion
                      </button>
                    ))}
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

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-600 border-t pt-3">
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

              {org.deletionScheduledAt && (
                <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded text-sm text-amber-800">
                  ⏳ Scheduled for deletion - can be permanently deleted on{' '}
                  <span className="font-medium">{purgeEligibleDate(org)?.toLocaleDateString()}</span>.
                  Click <span className="font-medium">Cancel deletion</span> to restore it any time before then.
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create Organization Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-1">Create Organization</h3>
            <p className="text-sm text-gray-600 mb-4">
              Creates an <span className="font-medium">active</span> shop + owner account immediately (no approval needed).
            </p>
            {createError && <div className="mb-3 p-2 bg-red-100 text-red-700 rounded text-sm">{createError}</div>}
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Business / Shop Name *</label>
                  <input className="w-full px-3 py-2 border border-gray-300 rounded-md" value={createForm.organizationName}
                    onChange={(e) => setCreateForm({ ...createForm, organizationName: e.target.value })} placeholder="Shop name" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Business Type *</label>
                  <select className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white" value={createForm.organizationType}
                    onChange={(e) => setCreateForm({ ...createForm, organizationType: e.target.value })}>
                    <option value="RETAIL_STORE">Retail Store</option>
                    <option value="WHOLESALE">Wholesale</option>
                    <option value="SUPERMARKET">Supermarket</option>
                    <option value="GENERAL_STORE">General Store</option>
                    <option value="CONVENIENCE_STORE">Convenience Store</option>
                    <option value="PHARMACY">Pharmacy</option>
                    <option value="ELECTRONICS_STORE">Electronics Store</option>
                    <option value="CLOTHING_STORE">Clothing Store</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">City *</label>
                  <input className="w-full px-3 py-2 border border-gray-300 rounded-md" value={createForm.city}
                    onChange={(e) => setCreateForm({ ...createForm, city: e.target.value })} placeholder="City" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Owner Phone</label>
                  <input className="w-full px-3 py-2 border border-gray-300 rounded-md" value={createForm.ownerPhone}
                    onChange={(e) => setCreateForm({ ...createForm, ownerPhone: e.target.value })} placeholder="+92XXXXXXXXXX (optional)" />
                </div>
              </div>
              <div className="border-t pt-3">
                <p className="text-sm font-medium text-gray-700 mb-2">Owner Account</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Owner Name *</label>
                    <input className="w-full px-3 py-2 border border-gray-300 rounded-md" value={createForm.ownerName}
                      onChange={(e) => setCreateForm({ ...createForm, ownerName: e.target.value })} placeholder="Full name" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Owner Email *</label>
                    <input type="email" className="w-full px-3 py-2 border border-gray-300 rounded-md" value={createForm.ownerEmail}
                      onChange={(e) => setCreateForm({ ...createForm, ownerEmail: e.target.value })} placeholder="owner@email.com" />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Temporary Password * (min 8 chars)</label>
                    <input className="w-full px-3 py-2 border border-gray-300 rounded-md" value={createForm.ownerPassword}
                      onChange={(e) => setCreateForm({ ...createForm, ownerPassword: e.target.value })} placeholder="Owner sets their own later" />
                  </div>
                </div>
              </div>
            </div>
            <div className="flex gap-2 justify-end mt-5">
              <button onClick={() => setShowCreateModal(false)} disabled={creating}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md disabled:opacity-50">Cancel</button>
              <button onClick={createOrg} disabled={creating}
                className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-md disabled:opacity-50">
                {creating ? 'Creating...' : 'Create Organization'}
              </button>
            </div>
          </div>
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

      {/* Permanent Delete (purge) Modal */}
      {showPurgeModal && purgeOrgData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-1 text-red-700">Delete organization permanently</h3>
            <p className="text-sm text-gray-600 mb-4">
              This permanently removes <span className="font-semibold">{purgeOrgData.name}</span> and all of its data.
              This cannot be undone.
            </p>

            {purgeError && <div className="mb-3 p-2 bg-red-100 text-red-700 rounded text-sm">{purgeError}</div>}

            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-800">
              {purgePreview ? (
                <>
                  <p className="font-medium mb-1">The following will be permanently deleted:</p>
                  <p>
                    {purgePreview.shops} shop(s) · {purgePreview.products} products · {purgePreview.invoices} invoices ·{' '}
                    {purgePreview.customers} customers · {purgePreview.suppliers} suppliers · {purgePreview.purchases} purchases
                  </p>
                </>
              ) : (
                <p>Loading what will be removed…</p>
              )}
            </div>

            <div className="space-y-2 mb-4">
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" checked={purgeDeleteOwner} onChange={(e) => setPurgeDeleteOwner(e.target.checked)} className="mt-0.5" />
                <span>
                  Also delete the owner account
                  {purgePreview?.owner && <span className="text-gray-500"> ({purgePreview.owner.email})</span>}
                  <span className="block text-xs text-gray-500">Frees their email / phone / CNIC to sign up again.</span>
                </span>
              </label>
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" checked={purgeDeleteStaff} onChange={(e) => setPurgeDeleteStaff(e.target.checked)} className="mt-0.5" />
                <span>
                  Also delete {purgePreview?.staffCount ?? 0} staff account(s) unique to this org
                  <span className="block text-xs text-gray-500">Accounts shared with another organization are never touched.</span>
                </span>
              </label>
            </div>

            <label className="block text-sm font-medium text-gray-700 mb-1">
              Type <span className="font-mono font-semibold">{purgeOrgData.name}</span> to confirm
            </label>
            <input
              value={purgeConfirmName}
              onChange={(e) => setPurgeConfirmName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md mb-4"
              placeholder={purgeOrgData.name}
            />

            <div className="flex gap-2 justify-end">
              <button
                onClick={() => { setShowPurgeModal(false); setPurgeOrgData(null) }}
                disabled={purging}
                className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmPurge}
                disabled={purging || purgeConfirmName.trim() !== purgeOrgData.name}
                className="px-4 py-2 bg-red-700 text-white rounded-md hover:bg-red-800 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {purging ? 'Deleting…' : 'Delete permanently'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
