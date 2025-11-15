'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'

interface Supplier {
  id: string
  name: string
  phone: string | null
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
    notes: '',
  })
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const fetchSuppliers = useCallback(async () => {
    if (!user?.currentShopId) return

    try {
      setLoading(true)
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
      }
    } catch (err) {
      console.error('Failed to fetch suppliers:', err)
    } finally {
      setLoading(false)
    }
  }, [user?.currentShopId, currentPage, searchTerm])

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
      if (formData.notes) payload.notes = formData.notes

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || `Failed to ${editingSupplier ? 'update' : 'create'} supplier`)
        setSubmitting(false)
        return
      }

      // Reset form and refresh list
      setShowForm(false)
      setEditingSupplier(null)
      await fetchSuppliers()
    } catch (err) {
      setError('An error occurred. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    setCurrentPage(1)
    fetchSuppliers()
  }

  if (!user?.currentShopId) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-4">Suppliers</h1>
        <p className="text-gray-600">Please select a shop first</p>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Suppliers</h1>
        <button
          onClick={openCreateForm}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Add Supplier
        </button>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="mb-4">
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Search suppliers (name, phone)..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 px-4 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
          >
            Search
          </button>
        </div>
      </form>

      {/* Supplier Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
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
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Supplier name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Phone</label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Phone number"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Notes</label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows={3}
                    placeholder="Additional notes"
                  />
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false)
                    setEditingSupplier(null)
                    setError('')
                  }}
                  className="px-4 py-2 border rounded hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : editingSupplier ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Suppliers List */}
      {loading ? (
        <div className="text-center py-8">Loading...</div>
      ) : suppliers.length === 0 ? (
        <div className="text-center py-8 text-gray-600">
          {searchTerm ? 'No suppliers found' : 'No suppliers yet. Create your first supplier!'}
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse border">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border p-2 text-left">Name</th>
                  <th className="border p-2 text-left">Phone</th>
                  <th className="border p-2 text-left">Notes</th>
                  <th className="border p-2 text-center">Purchases</th>
                  <th className="border p-2 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {suppliers.map((supplier) => (
                  <tr key={supplier.id} className="hover:bg-gray-50">
                    <td className="border p-2 font-medium">{supplier.name}</td>
                    <td className="border p-2">{supplier.phone || '-'}</td>
                    <td className="border p-2">{supplier.notes || '-'}</td>
                    <td className="border p-2 text-center">
                      {supplier._count.purchases}
                    </td>
                    <td className="border p-2 text-center">
                      <button
                        onClick={() => openEditForm(supplier)}
                        className="text-blue-600 hover:underline"
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
    </div>
  )
}
