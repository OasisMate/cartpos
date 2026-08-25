'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'
import Button from '@/components/ui/Button'
import EmptyState from '@/components/ui/EmptyState'
import { Table, THead, TR, TH, EmptyRow } from '@/components/ui/DataTable'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/components/ui/ToastProvider'

/**
 * The purchase lists index: the way into the feature. One row per list,
 * newest first, so a shopkeeper can jump back into a draft or check what
 * already went out to a supplier.
 */

interface PurchaseListRow {
  id: string
  name: string | null
  status: 'DRAFT' | 'SENT' | 'RECEIVED'
  createdAt: string
  supplier: { id: string; name: string } | null
  _count: { lines: number }
}

const statusBadge: Record<PurchaseListRow['status'], string> = {
  DRAFT: 'bg-gray-100 text-gray-600 border border-gray-200',
  SENT: 'bg-blue-50 text-blue-700 border border-blue-100',
  RECEIVED: 'bg-emerald-50 text-emerald-700 border border-emerald-100',
}

export default function PurchaseListsPage() {
  const { user } = useAuth()
  const { show } = useToast()
  const router = useRouter()
  const [lists, setLists] = useState<PurchaseListRow[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)

  const load = useCallback(async () => {
    if (!user?.currentShopId) return
    setLoading(true)
    try {
      const res = await fetch('/api/purchase-lists?limit=100')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load purchase lists')
      setLists(data.lists || [])
    } catch (err: any) {
      show({ message: err.message || 'Failed to load purchase lists', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [user?.currentShopId, show])

  useEffect(() => {
    load()
  }, [load])

  async function handleCreate() {
    setCreating(true)
    try {
      const res = await fetch('/api/purchase-lists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to create list')
      router.push(`/store/purchase-lists/${data.id}`)
    } catch (err: any) {
      show({ message: err.message || 'Failed to create list', variant: 'destructive' })
      setCreating(false)
    }
  }

  if (!user?.currentShopId) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-4">Purchase Lists</h1>
        <p className="text-gray-600">Please select a shop first</p>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Purchase Lists</h1>
        <Button onClick={handleCreate} disabled={creating} className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          <span>{creating ? 'Creating...' : 'New list'}</span>
        </Button>
      </div>

      {loading ? (
        <div className="py-8 text-center text-gray-500">Loading...</div>
      ) : lists.length === 0 ? (
        <EmptyState
          title="No purchase lists yet"
          description="Start one when you next walk the shelves."
        />
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <THead>
              <TR>
                <TH>Name</TH>
                <TH>Supplier</TH>
                <TH className="text-right">Items</TH>
                <TH>Status</TH>
                <TH>Date</TH>
              </TR>
            </THead>
            <tbody>
              {lists.length === 0 ? (
                <EmptyRow colSpan={5} message="No purchase lists yet" />
              ) : (
                lists.map((list) => (
                  <tr
                    key={list.id}
                    className="border-b border-[hsl(var(--border))] hover:bg-[hsl(var(--muted))]"
                  >
                    <td className="py-2 px-3">
                      <Link
                        href={`/store/purchase-lists/${list.id}`}
                        className="font-medium text-orange-600 hover:underline"
                      >
                        {list.name || 'Untitled list'}
                      </Link>
                    </td>
                    <td className="py-2 px-3">{list.supplier?.name || '-'}</td>
                    <td className="py-2 px-3 text-right">{list._count.lines}</td>
                    <td className="py-2 px-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[11px] uppercase tracking-wide ${statusBadge[list.status]}`}
                      >
                        {list.status.toLowerCase()}
                      </span>
                    </td>
                    <td className="py-2 px-3">{new Date(list.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </Table>
        </div>
      )}
    </div>
  )
}
