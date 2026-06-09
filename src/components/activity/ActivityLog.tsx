'use client'

import { useCallback, useEffect, useState } from 'react'
import { format } from 'date-fns'
import { Table, THead, TR, TH, TD } from '@/components/ui/DataTable'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import EmptyState from '@/components/ui/EmptyState'

interface Activity {
  id: string
  action: string
  entityType: string
  entityId: string | null
  details: Record<string, any> | null
  createdAt: string
  user: { id: string; name: string; email: string } | null
  shop: { id: string; name: string } | null
}

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

// Friendly labels for the action codes recorded in the audit trail.
const ACTION_LABELS: Record<string, string> = {
  CREATE_PRODUCT: 'Created product',
  UPDATE_PRODUCT: 'Updated product',
  ARCHIVE_PRODUCT: 'Archived product',
  DELETE_PRODUCT: 'Deleted product',
  CREATE_SALE: 'Recorded sale',
  VOID_SALE: 'Voided sale',
  CREATE_CUSTOMER: 'Added customer',
  UPDATE_CUSTOMER: 'Edited customer',
  CREATE_PURCHASE: 'Recorded purchase',
  CREATE_STORE: 'Created store',
  UPDATE_STORE: 'Updated store',
  DELETE_STORE: 'Deleted store',
  UPDATE_STORE_SETTINGS: 'Updated store settings',
  CREATE_USER: 'Created user',
  UPDATE_USER: 'Updated user',
  REMOVE_USER: 'Removed user',
  ASSIGN_STORE: 'Assigned to store',
  REMOVE_FROM_STORE: 'Removed from store',
  RESET_PASSWORD: 'Reset password',
  UPDATE_PROFILE: 'Updated profile',
  CHANGE_PASSWORD: 'Changed password',
  UPDATE_ORG_SETTINGS: 'Updated org settings',
  APPROVE_ORG: 'Approved organization',
  SUSPEND_ORG: 'Suspended organization',
  REJECT_ORG: 'Rejected organization',
  REACTIVATE_ORG: 'Reactivated organization',
}

const ACTION_OPTIONS = Object.keys(ACTION_LABELS)

function humanizeAction(action: string): string {
  return (
    ACTION_LABELS[action] ||
    action
      .toLowerCase()
      .split('_')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ')
  )
}

function actionColor(action: string): string {
  if (/^(CREATE|ASSIGN|APPROVE|REACTIVATE)/.test(action)) return 'bg-green-100 text-green-800'
  if (/^(UPDATE|CHANGE|RESET)/.test(action)) return 'bg-blue-100 text-blue-800'
  if (/^(DELETE|REMOVE|VOID|SUSPEND|REJECT|ARCHIVE)/.test(action)) return 'bg-red-100 text-red-800'
  return 'bg-gray-100 text-gray-800'
}

// Pull the most meaningful piece of context out of the details JSON.
function describeDetails(d: Record<string, any> | null): string {
  if (!d) return ''
  const parts: string[] = []
  if (d.name) parts.push(String(d.name))
  if (d.number) parts.push(`#${d.number}`)
  if (d.reference) parts.push(String(d.reference))
  if (d.reason) parts.push(`— ${d.reason}`)
  return parts.join(' ')
}

export default function ActivityLog() {
  const [activities, setActivities] = useState<Activity[]>([])
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 50, total: 0, totalPages: 1 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)
  const [filters, setFilters] = useState({ action: '', startDate: '', endDate: '' })

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams({ page: page.toString(), limit: '50' })
      if (filters.action) params.set('action', filters.action)
      if (filters.startDate) params.set('startDate', filters.startDate)
      if (filters.endDate) params.set('endDate', filters.endDate)

      const res = await fetch(`/api/org/activity?${params}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load activity')
      setActivities(data.activities || [])
      setPagination(data.pagination || { page: 1, limit: 50, total: 0, totalPages: 1 })
    } catch (e: any) {
      setError(e.message || 'Failed to load activity')
    } finally {
      setLoading(false)
    }
  }, [page, filters])

  useEffect(() => {
    load()
  }, [load])

  const onFilter = (key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }))
    setPage(1)
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Activity Log</h1>
        <p className="text-sm text-gray-600 mt-1">
          Who did what, and when — across all stores in this organization.
        </p>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg border border-gray-200 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Action</label>
            <Select value={filters.action} onChange={(e) => onFilter('action', e.target.value)}>
              <option value="">All actions</option>
              {ACTION_OPTIONS.map((a) => (
                <option key={a} value={a}>
                  {humanizeAction(a)}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">From</label>
            <Input type="date" value={filters.startDate} onChange={(e) => onFilter('startDate', e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">To</label>
            <Input type="date" value={filters.endDate} onChange={(e) => onFilter('endDate', e.target.value)} />
          </div>
          <div className="flex items-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setFilters({ action: '', startDate: '', endDate: '' })
                setPage(1)
              }}
            >
              Clear Filters
            </Button>
          </div>
        </div>
      </div>

      {error && <div className="mb-4 p-3 bg-red-100 text-red-700 rounded">{error}</div>}

      {loading ? (
        <div className="text-center py-8 text-gray-500">Loading...</div>
      ) : activities.length === 0 ? (
        <EmptyState title="No activity yet" description="Actions taken in your stores will show up here." />
      ) : (
        <>
          <div className="overflow-x-auto">
            <Table>
              <THead>
                <TR>
                  <TH>When</TH>
                  <TH>Who</TH>
                  <TH>Action</TH>
                  <TH>Details</TH>
                  <TH>Store</TH>
                </TR>
              </THead>
              <tbody>
                {activities.map((a) => (
                  <TR key={a.id}>
                    <TD className="whitespace-nowrap text-sm text-gray-600">
                      {format(new Date(a.createdAt), 'MMM d, yyyy h:mm a')}
                    </TD>
                    <TD className="text-sm">
                      <div className="font-medium text-gray-900">{a.user?.name || '—'}</div>
                      {a.user?.email && <div className="text-xs text-gray-400">{a.user.email}</div>}
                    </TD>
                    <TD>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${actionColor(a.action)}`}>
                        {humanizeAction(a.action)}
                      </span>
                    </TD>
                    <TD className="text-sm text-gray-700">{describeDetails(a.details) || '—'}</TD>
                    <TD className="text-sm text-gray-600">{a.shop?.name || '—'}</TD>
                  </TR>
                ))}
              </tbody>
            </Table>
          </div>

          {pagination.totalPages > 1 && (
            <div className="mt-4 flex justify-between items-center">
              <div className="text-sm text-gray-600">
                Showing {activities.length} of {pagination.total} entries
              </div>
              <div className="flex gap-2 items-center">
                <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
                  Previous
                </Button>
                <span className="px-2 text-sm text-gray-600">
                  Page {page} of {pagination.totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                  disabled={page === pagination.totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
