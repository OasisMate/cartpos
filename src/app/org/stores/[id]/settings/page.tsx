'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { Settings as SettingsIcon, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

interface StoreSettings {
  id: string
  shopId: string
  requireCostPriceForStockItems: boolean
  requireBarcodeForProducts: boolean
  allowCustomUnits: boolean
  languageMode: string
}

export default function StoreSettingsPage() {
  const router = useRouter()
  const params = useParams()
  const { user } = useAuth()
  const storeId = params.id as string

  const [settings, setSettings] = useState<StoreSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [formData, setFormData] = useState({
    requireCostPriceForStockItems: false,
    requireBarcodeForProducts: false,
    allowCustomUnits: true,
    languageMode: 'EN_BILINGUAL',
  })

  const loadSettings = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/org/stores/${storeId}/settings`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load settings')
      
      setSettings(data.settings)
      setFormData({
        requireCostPriceForStockItems: data.settings.requireCostPriceForStockItems || false,
        requireBarcodeForProducts: data.settings.requireBarcodeForProducts || false,
        allowCustomUnits: data.settings.allowCustomUnits !== undefined ? data.settings.allowCustomUnits : true,
        languageMode: data.settings.languageMode || 'EN_BILINGUAL',
      })
    } catch (e: any) {
      setError(e.message || 'Failed to load settings')
    } finally {
      setLoading(false)
    }
  }, [storeId])

  useEffect(() => {
    if (user && storeId) {
      loadSettings()
    }
  }, [user, storeId, loadSettings])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    setSuccess('')

    try {
      const res = await fetch(`/api/org/stores/${storeId}/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to update settings')

      setSuccess('Settings updated successfully')
      await loadSettings()
      setTimeout(() => setSuccess(''), 3000)
    } catch (e: any) {
      setError(e.message || 'Failed to update settings')
    } finally {
      setSaving(false)
    }
  }

  if (!user) {
    return null
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-600">Loading...</div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto py-8">
      <div className="mb-6">
        <Link
          href={`/org/stores/${storeId}`}
          className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Store
        </Link>
        <h1 className="text-3xl font-bold mb-2 bg-gradient-to-r from-blue-600 to-orange-600 bg-clip-text text-transparent flex items-center gap-3">
          <SettingsIcon className="h-8 w-8 text-blue-600" />
          Store Settings
        </h1>
        <p className="text-gray-600">Configure store preferences and requirements</p>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {success && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-sm text-green-600">{success}</p>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6">
        <form onSubmit={handleSave} className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Product Requirements</h2>
            <div className="space-y-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.requireCostPriceForStockItems}
                  onChange={(e) =>
                    setFormData({ ...formData, requireCostPriceForStockItems: e.target.checked })
                  }
                  disabled={saving}
                  className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 disabled:cursor-not-allowed"
                />
                <div>
                  <span className="font-medium text-gray-900">Require Cost Price for Stock Items</span>
                  <p className="text-sm text-gray-600">
                    When enabled, cost price must be provided when adding products that track stock
                  </p>
                </div>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.requireBarcodeForProducts}
                  onChange={(e) =>
                    setFormData({ ...formData, requireBarcodeForProducts: e.target.checked })
                  }
                  disabled={saving}
                  className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 disabled:cursor-not-allowed"
                />
                <div>
                  <span className="font-medium text-gray-900">Require Barcode for Products</span>
                  <p className="text-sm text-gray-600">
                    When enabled, barcode must be provided when creating new products
                  </p>
                </div>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.allowCustomUnits}
                  onChange={(e) =>
                    setFormData({ ...formData, allowCustomUnits: e.target.checked })
                  }
                  disabled={saving}
                  className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 disabled:cursor-not-allowed"
                />
                <div>
                  <span className="font-medium text-gray-900">Allow Custom Units</span>
                  <p className="text-sm text-gray-600">
                    When enabled, users can define custom units for products (e.g., &quot;pack&quot;, &quot;dozen&quot;)
                  </p>
                </div>
              </label>
            </div>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Language Settings</h2>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Language Mode
              </label>
              <select
                value={formData.languageMode}
                onChange={(e) => setFormData({ ...formData, languageMode: e.target.value })}
                disabled={saving}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all disabled:bg-gray-50 disabled:cursor-not-allowed"
              >
                <option value="EN_ONLY">English Only</option>
                <option value="EN_BILINGUAL">English Bilingual</option>
              </select>
              <p className="mt-1 text-sm text-gray-600">
                Select the language mode for invoices and receipts
              </p>
            </div>
          </div>

          <div className="flex gap-3 pt-4 border-t border-gray-200">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
            <button
              type="button"
              onClick={() => loadSettings()}
              disabled={saving}
              className="px-6 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Reset
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

