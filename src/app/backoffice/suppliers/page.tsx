'use client'

import { useState, useEffect, useCallback } from 'react'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { Table, THead, TR, TH, TD, EmptyRow } from '@/components/ui/DataTable'
import { useToast } from '@/components/ui/ToastProvider'
import { useAuth } from '@/contexts/AuthContext'
import { Plus, Pencil, Trash2, Loader2 } from 'lucide-react'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { getSuppliersWithCache } from '@/lib/offline/data'

interface Supplier {
  id: string
  name: string
  phone: string | null
  address: string | null
  notes: string | null
  createdAt: string
  _count: {
    purchases: number
  }
}

interface SuppliersResponse {
  suppliers: Supplier[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export default function SuppliersPage() {
  const { user } = useAuth()
  const { show } = useToast()
  const isOnline = useOnlineStatus()
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 1,
  })
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    address: '',
    notes: '',
  })
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [deletingSupplierId, setDeletingSupplierId] = useState<string | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [supplierToDelete, setSupplierToDelete] = useState<Supplier | null>(null)

  const fetchSuppliers = useCallback(async () => {
    if (!user?.currentShopId) return

    try {
      setLoading(true)
      
      if (isOnline) {
        // Online: try API first
        try {
          const params = new URLSearchParams({
            page: currentPage.toString(),
            limit: '50',
          })
          if (searchTerm) {
            params.append('search', searchTerm)
          }

          const response = await fetch(`/api/suppliers?${params}`)
          if (response.ok) {
            const data: SuppliersResponse = await response.json()
            setSuppliers(data.suppliers || [])
            setPagination(data.pagination)
            setLoading(false)
            return
          }
        } catch (apiError) {
          console.warn('API failed, falling back to cache:', apiError)
        }
      }
      
      // Offline or API failed: use cache
      const cached = await getSuppliersWithCache(user.currentShopId, isOnline)
      let rows = cached.map((s) => ({
        id: s.id,
        name: s.name,
        phone: s.phone,
        address: (s as any).address || null,
        notes: s.notes,
        createdAt: new Date(s.updatedAt).toISOString(),
        _count: { purchases: 0 }, // Purchase count requires server data
      }))
      
      // Apply search filter
      if (searchTerm) {
        const term = searchTerm.toLowerCase()
        rows = rows.filter((s) => 
          s.name.toLowerCase().includes(term) ||
          (s.phone && s.phone.includes(term))
        )
      }
      
      setSuppliers(rows)
      setPagination({
        page: 1,
        limit: 50,
        total: rows.length,
        totalPages: 1,
      })
    } catch (err) {
      console.error('Failed to fetch suppliers:', err)
    } finally {
      setLoading(false)
    }
  }, [user?.currentShopId, currentPage, searchTerm, isOnline])

  useEffect(() => {
    if (user?.currentShopId) {
      fetchSuppliers()
    }
  }, [user?.currentShopId, fetchSuppliers])

  function openCreateForm() {
    setEditingSupplier(null)
    setFormData({
      name: '',
      phone: '',
      address: '',
      notes: '',
    })
    setError('')
    setShowForm(true)
  }

  function openEditForm(supplier: Supplier) {
    setEditingSupplier(supplier)
    setFormData({
      name: supplier.name,
      phone: supplier.phone || '',
      address: supplier.address || '',
      notes: supplier.notes || '',
    })
    setError('')
    setShowForm(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSubmitting(true)

    try {
      const url = editingSupplier
        ? `/api/suppliers/${editingSupplier.id}`
        : '/api/suppliers'
      const method = editingSupplier ? 'PUT' : 'POST'

      const payload: any = {
        name: formData.name,
      }

      if (formData.phone) payload.phone = formData.phone
      if (formData.address) payload.address = formData.address
      if (formData.notes) payload.notes = formData.notes

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await response.json()

      if (!response.ok) {
        const msg = data.error || `Failed to ${editingSupplier ? 'update' : 'create'} supplier`
        setError(msg)
        show({ title: 'Error', message: msg, variant: 'destructive' })
        setSubmitting(false)
        return
      }

      // Reset form and refresh list
      setShowForm(false)
      setEditingSupplier(null)
      await fetchSuppliers()
      show({ message: editingSupplier ? 'Supplier updated' : 'Supplier created', variant: 'success' })
    } catch (err) {
      setError('An error occurred. Please try again.')
      show({ title: 'Error', message: 'Unexpected error', variant: 'destructive' })
    } finally {
      setSubmitting(false)
    }
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    setCurrentPage(1)
    fetchSuppliers()
  }

  const handleDeleteClick = (supplier: Supplier) => {
    setSupplierToDelete(supplier)
    setShowDeleteConfirm(true)
  }

  const handleDeleteConfirm = async () => {
    if (!supplierToDelete) return

    setDeletingSupplierId(supplierToDelete.id)
    try {
      const response = await fetch(`/api/suppliers/${supplierToDelete.id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to delete supplier')
      }

      show({
        title: 'Success',
        message: 'Supplier deleted successfully',
        variant: 'success',
      })

      setShowDeleteConfirm(false)
      setSupplierToDelete(null)
      await fetchSuppliers()
    } catch (err: any) {
      show({
        title: 'Error',
        message: err.message || 'Failed to delete supplier',
        variant: 'destructive',
      })
    } finally {
      setDeletingSupplierId(null)
    }
  }

  if (!user?.currentShopId) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-4">Suppliers</h1>
        {user?.role === 'PLATFORM_ADMIN' ? (
          <div className="space-y-3">
            <p className="text-[hsl(var(--muted-foreground))]">No shop selected. Go to Admin to manage or create a shop.</p>
            <div className="flex gap-2">
              <a href="/admin/shops" className="btn btn-primary h-9 px-4">Open Shops</a>
              <a href="/admin" className="btn btn-outline h-9 px-4">Admin</a>
            </div>
          </div>
        ) : (
          <p className="text-[hsl(var(--muted-foreground))]">Please select a shop first</p>
        )}
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Suppliers</h1>
        <Button onClick={openCreateForm} className="flex items-center gap-2">
          <Plus className="w-4 h-4" />
          <span>Add Supplier</span>
        </Button>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="mb-4">
        <div className="flex gap-2">
          <Input
            placeholder="Search suppliers (name, phone)..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1"
          />
          <Button type="submit" variant="outline">Search</Button>
        </div>
      </form>

      {/* Supplier Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-[hsl(var(--card))] rounded-lg p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto border border-[hsl(var(--border))]">
            <h2 className="text-xl font-bold mb-4">
              {editingSupplier ? 'Edit Supplier' : 'Add Supplier'}
            </h2>

            {error && (
              <div className="mb-4 p-3 bg-red-100 text-red-700 rounded">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Name <span className="text-red-500">*</span>
                  </label>
                  <Input
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Supplier name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Phone</label>
                  <Input
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="Phone number"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Address</label>
                  <textarea
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="w-full input min-h-[80px]"
                    rows={2}
                    placeholder="Supplier address"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Notes</label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    className="w-full input min-h-[96px]"
                    rows={3}
                    placeholder="Additional notes"
                  />
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowForm(false)
                    setEditingSupplier(null)
                    setError('')
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting ? 'Saving...' : editingSupplier ? 'Update' : 'Create'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Suppliers List */}
      {loading ? (
        <div className="text-center py-8">Loading...</div>
      ) : suppliers.length === 0 ? (
        <div className="text-center py-8 text-[hsl(var(--muted-foreground))]">
          {searchTerm ? 'No suppliers found' : 'No suppliers yet. Create your first supplier!'}
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <Table>
              <THead>
                <TR>
                  <TH>Name</TH>
                  <TH>Phone</TH>
                  <TH>Address</TH>
                  <TH>Notes</TH>
                  <TH className="text-center">Purchases</TH>
                  <TH className="text-center">Actions</TH>
                </TR>
              </THead>
              <tbody>
                {suppliers.length === 0 ? (
                  <EmptyRow colSpan={6} message="No suppliers" />
                ) : (
                  suppliers.map((supplier) => (
                    <TR key={supplier.id}>
                      <TD className="font-medium">{supplier.name}</TD>
                      <TD>{supplier.phone || '-'}</TD>
                      <TD>{supplier.address || '-'}</TD>
                      <TD>{supplier.notes || '-'}</TD>
                      <TD className="text-center">{supplier._count.purchases}</TD>
                      <TD className="text-center">
                        <div className="flex gap-2 justify-center">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => openEditForm(supplier)}
                            className="p-2"
                            title="Edit"
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => handleDeleteClick(supplier)}
                            className="p-2 text-red-600 hover:text-red-700 hover:border-red-600"
                            disabled={deletingSupplierId === supplier.id}
                            title="Delete"
                          >
                            {deletingSupplierId === supplier.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
                          </Button>
                        </div>
                      </TD>
                    </TR>
                  ))
                )}
              </tbody>
            </Table>
          </div>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="mt-4 flex justify-between items-center">
              <div className="text-sm text-gray-600">
                Showing {suppliers.length} of {pagination.total} suppliers
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-4 py-2 border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  Previous
                </button>
                <span className="px-4 py-2">
                  Page {currentPage} of {pagination.totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(pagination.totalPages, p + 1))}
                  disabled={currentPage === pagination.totalPages}
                  className="px-4 py-2 border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && supplierToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Delete Supplier</h2>
            <p className="text-sm text-gray-600 mb-4">
              Are you sure you want to delete <span className="font-semibold">{supplierToDelete.name}</span>?
            </p>
            <p className="text-sm text-red-600 mb-6">
              This action cannot be undone. Suppliers that have been used in purchases cannot be deleted.
            </p>
            <div className="flex gap-2 justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowDeleteConfirm(false)
                  setSupplierToDelete(null)
                }}
                disabled={deletingSupplierId !== null}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={deletingSupplierId !== null}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                {deletingSupplierId ? 'Deleting...' : 'Delete'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
