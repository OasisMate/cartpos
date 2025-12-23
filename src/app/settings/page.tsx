'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { useAuth } from '@/contexts/AuthContext'
import { Settings as SettingsIcon, Lock, User, Mail, Phone, CreditCard, Printer } from 'lucide-react'
import { formatCNIC } from '@/lib/validation'

export default function SettingsPage() {
  const { user, refreshUser } = useAuth()
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  
  // Profile form state
  const [profileData, setProfileData] = useState({
    name: '',
    phone: '',
    isWhatsApp: false,
  })
  
  // Password form state
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  })
  const [showPasswordForm, setShowPasswordForm] = useState(false)
  
  // Shop settings state (for STORE_MANAGER only)
  const [shopSettings, setShopSettings] = useState({
    printerName: '',
    autoPrint: false,
    logoUrl: null as string | null,
    receiptHeaderDisplay: 'NAME_ONLY' as 'NAME_ONLY' | 'LOGO_ONLY' | 'BOTH',
  })
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [loadingSettings, setLoadingSettings] = useState(false)
  const [savingSettings, setSavingSettings] = useState(false)
  const [settingsError, setSettingsError] = useState('')
  const [settingsSuccess, setSettingsSuccess] = useState('')
  
  // Check if user is STORE_MANAGER
  const isStoreManager = user?.shops?.some(
    (s) => s.shopId === user?.currentShopId && s.shopRole === 'STORE_MANAGER'
  )

  useEffect(() => {
    if (user) {
      setProfileData({
        name: user.name || '',
        phone: user.phone || '',
        isWhatsApp: user.isWhatsApp || false,
      })
    }
  }, [user])

  // Load shop settings if user is STORE_MANAGER
  useEffect(() => {
    async function loadShopSettings() {
      if (!isStoreManager || !user?.currentShopId) return
      
      try {
        setLoadingSettings(true)
        const response = await fetch('/api/shop/settings')
        if (response.ok) {
          const data = await response.json()
          setShopSettings({
            printerName: data.settings?.printerName || '',
            autoPrint: data.settings?.autoPrint || false,
            logoUrl: data.settings?.logoUrl || null,
            receiptHeaderDisplay: data.settings?.receiptHeaderDisplay || 'NAME_ONLY',
          })
          if (data.settings?.logoUrl) {
            setLogoPreview(data.settings.logoUrl)
          }
        }
      } catch (err) {
        console.error('Failed to load shop settings:', err)
      } finally {
        setLoadingSettings(false)
      }
    }
    
    loadShopSettings()
  }, [isStoreManager, user?.currentShopId])

  const handleProfileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target
    setProfileData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }))
    setError('')
    setSuccess('')
  }

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    setSuccess('')

    try {
      const response = await fetch('/api/me', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profileData),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update profile')
      }

      setSuccess('Profile updated successfully')
      await refreshUser()
      setTimeout(() => setSuccess(''), 3000)
    } catch (err: any) {
      setError(err.message || 'Failed to update profile')
    } finally {
      setSaving(false)
    }
  }

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setPasswordData((prev) => ({
      ...prev,
      [name]: value,
    }))
    setError('')
  }

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    setSuccess('')

    // Validation
    if (passwordData.newPassword.length < 6) {
      setError('New password must be at least 6 characters')
      setSaving(false)
      return
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setError('Passwords do not match')
      setSaving(false)
      return
    }

    try {
      const response = await fetch('/api/me/password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: passwordData.currentPassword,
          newPassword: passwordData.newPassword,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to change password')
      }

      setSuccess('Password changed successfully')
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      })
      setShowPasswordForm(false)
      setTimeout(() => setSuccess(''), 3000)
    } catch (err: any) {
      setError(err.message || 'Failed to change password')
    } finally {
      setSaving(false)
    }
  }

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (!file.type.includes('png')) {
        setSettingsError('Only PNG images are allowed')
        return
      }
      if (file.size > 2 * 1024 * 1024) {
        setSettingsError('File size must be less than 2MB')
        return
      }
      setLogoFile(file)
      const reader = new FileReader()
      reader.onloadend = () => {
        setLogoPreview(reader.result as string)
      }
      reader.readAsDataURL(file)
      setSettingsError('')
    }
  }

  const handleLogoUpload = async () => {
    if (!logoFile) return

    setUploadingLogo(true)
    setSettingsError('')
    try {
      const formData = new FormData()
      formData.append('logo', logoFile)

      const response = await fetch('/api/shop/logo', {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to upload logo')
      }

      setShopSettings({ ...shopSettings, logoUrl: data.logoUrl })
      setLogoFile(null)
      setSettingsSuccess('Logo uploaded successfully')
      setTimeout(() => setSettingsSuccess(''), 3000)
    } catch (err: any) {
      setSettingsError(err.message || 'Failed to upload logo')
    } finally {
      setUploadingLogo(false)
    }
  }

  const handleLogoRemove = async () => {
    setUploadingLogo(true)
    setSettingsError('')
    try {
      const response = await fetch('/api/shop/logo', {
        method: 'DELETE',
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to remove logo')
      }

      setShopSettings({ ...shopSettings, logoUrl: null })
      setLogoPreview(null)
      setLogoFile(null)
      setSettingsSuccess('Logo removed successfully')
      setTimeout(() => setSettingsSuccess(''), 3000)
    } catch (err: any) {
      setSettingsError(err.message || 'Failed to remove logo')
    } finally {
      setUploadingLogo(false)
    }
  }

  const handleShopSettingsSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSavingSettings(true)
    setSettingsError('')
    setSettingsSuccess('')

    try {
      const response = await fetch('/api/shop/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          printerName: shopSettings.printerName,
          autoPrint: shopSettings.autoPrint,
          receiptHeaderDisplay: shopSettings.receiptHeaderDisplay,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update shop settings')
      }

      setSettingsSuccess('Settings updated successfully')
      setTimeout(() => setSettingsSuccess(''), 3000)
    } catch (err: any) {
      setSettingsError(err.message || 'Failed to update shop settings')
    } finally {
      setSavingSettings(false)
    }
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-600">Loading...</div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2 bg-gradient-to-r from-blue-600 to-orange-600 bg-clip-text text-transparent flex items-center gap-3">
          <SettingsIcon className="h-8 w-8 text-blue-600" />
          Settings
        </h1>
        <p className="text-gray-600">Manage your account and preferences</p>
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

      {settingsError && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-600">{settingsError}</p>
        </div>
      )}

      {settingsSuccess && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-sm text-green-600">{settingsSuccess}</p>
        </div>
      )}

      {/* Profile Settings */}
      <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <User className="h-5 w-5 text-blue-600" />
          <h2 className="text-xl font-semibold text-gray-900">Profile Information</h2>
        </div>

        <form onSubmit={handleProfileSubmit} className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
              Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="name"
              name="name"
              value={profileData.name}
              onChange={handleProfileChange}
              required
              disabled={saving}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all disabled:bg-gray-50 disabled:cursor-not-allowed"
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
              <Mail className="h-4 w-4" />
              Email
            </label>
            <input
              type="email"
              id="email"
              value={user.email || ''}
              disabled
              className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed"
            />
            <p className="mt-1 text-xs text-gray-500">
              Contact Organization Owner to change your email
            </p>
          </div>

          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
              <Phone className="h-4 w-4" />
              Phone Number
            </label>
            <input
              type="tel"
              id="phone"
              name="phone"
              value={profileData.phone}
              onChange={handleProfileChange}
              placeholder="+923001234567"
              disabled={saving}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all disabled:bg-gray-50 disabled:cursor-not-allowed"
            />
          </div>

          <div>
            <label htmlFor="cnic" className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              CNIC
            </label>
            <input
              type="text"
              id="cnic"
              value={user.cnic ? formatCNIC(user.cnic) : ''}
              disabled
              className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed"
            />
            <p className="mt-1 text-xs text-gray-500">
              Contact Organization Owner to change your CNIC
            </p>
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              id="isWhatsApp"
              name="isWhatsApp"
              checked={profileData.isWhatsApp}
              onChange={handleProfileChange}
              disabled={saving}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 disabled:cursor-not-allowed"
            />
            <label htmlFor="isWhatsApp" className="ml-2 text-sm text-gray-700">
              This phone number is on WhatsApp
            </label>
          </div>

          <div className="pt-4">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>

      {/* Password Change */}
      <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-blue-600" />
            <h2 className="text-xl font-semibold text-gray-900">Change Password</h2>
          </div>
          {!showPasswordForm && (
            <button
              onClick={() => setShowPasswordForm(true)}
              className="px-4 py-2 text-blue-600 hover:text-blue-700 font-medium text-sm"
            >
              Change Password
            </button>
          )}
        </div>

        {showPasswordForm && (
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <div>
              <label htmlFor="currentPassword" className="block text-sm font-medium text-gray-700 mb-2">
                Current Password <span className="text-red-500">*</span>
              </label>
              <input
                type="password"
                id="currentPassword"
                name="currentPassword"
                value={passwordData.currentPassword}
                onChange={handlePasswordChange}
                required
                disabled={saving}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all disabled:bg-gray-50 disabled:cursor-not-allowed"
              />
            </div>

            <div>
              <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 mb-2">
                New Password <span className="text-red-500">*</span>
              </label>
              <input
                type="password"
                id="newPassword"
                name="newPassword"
                value={passwordData.newPassword}
                onChange={handlePasswordChange}
                required
                minLength={6}
                disabled={saving}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all disabled:bg-gray-50 disabled:cursor-not-allowed"
              />
              <p className="mt-1 text-xs text-gray-500">
                Must be at least 6 characters long
              </p>
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">
                Confirm New Password <span className="text-red-500">*</span>
              </label>
              <input
                type="password"
                id="confirmPassword"
                name="confirmPassword"
                value={passwordData.confirmPassword}
                onChange={handlePasswordChange}
                required
                minLength={6}
                disabled={saving}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all disabled:bg-gray-50 disabled:cursor-not-allowed"
              />
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Changing...' : 'Change Password'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowPasswordForm(false)
                  setPasswordData({
                    currentPassword: '',
                    newPassword: '',
                    confirmPassword: '',
                  })
                  setError('')
                }}
                disabled={saving}
                className="px-6 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Shop Settings - Only for STORE_MANAGER */}
      {isStoreManager && (
        <>
          {/* Receipt Header Settings */}
          <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6 mb-6">
            <div className="flex items-center gap-2 mb-4">
              <SettingsIcon className="h-5 w-5 text-blue-600" />
              <h2 className="text-xl font-semibold text-gray-900">Receipt Header Settings</h2>
            </div>

            {loadingSettings ? (
              <div className="text-gray-600">Loading settings...</div>
            ) : (
              <div className="space-y-6">
                {/* Logo Upload */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Store Logo (PNG format, max 2MB)
                  </label>
                  <div className="flex items-start gap-4">
                    {logoPreview && (
                      <div className="relative">
                        <Image
                          src={logoPreview}
                          alt="Store logo preview"
                          width={128}
                          height={128}
                          className="w-32 h-32 object-contain border border-gray-300 rounded-lg bg-gray-50"
                        />
                        {shopSettings.logoUrl && (
                          <button
                            type="button"
                            onClick={handleLogoRemove}
                            disabled={uploadingLogo}
                            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-red-600 disabled:opacity-50"
                            title="Remove logo"
                          >
                            ×
                          </button>
                        )}
                      </div>
                    )}
                    <div className="flex-1">
                      <input
                        type="file"
                        accept="image/png"
                        onChange={handleLogoChange}
                        disabled={uploadingLogo || savingSettings}
                        className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed"
                      />
                      {logoFile && !shopSettings.logoUrl && (
                        <button
                          type="button"
                          onClick={handleLogoUpload}
                          disabled={uploadingLogo}
                          className="mt-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {uploadingLogo ? 'Uploading...' : 'Upload Logo'}
                        </button>
                      )}
                      <p className="mt-1 text-xs text-gray-500">
                        Upload a PNG image to display on receipts. Recommended size: 200x200px or smaller.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Receipt Header Display Option */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Receipt Header Display
                  </label>
                  <select
                    value={shopSettings.receiptHeaderDisplay}
                    onChange={(e) => setShopSettings({ ...shopSettings, receiptHeaderDisplay: e.target.value as any })}
                    disabled={savingSettings}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all disabled:bg-gray-50 disabled:cursor-not-allowed"
                  >
                    <option value="NAME_ONLY">Show Store Name Only</option>
                    <option value="LOGO_ONLY">Show Logo Only</option>
                    <option value="BOTH">Show Both Name and Logo</option>
                  </select>
                  <p className="mt-1 text-xs text-gray-500">
                    Choose what to display at the top of receipts.
                  </p>
                </div>

                <div className="pt-4 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={handleShopSettingsSubmit}
                    disabled={savingSettings}
                    className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {savingSettings ? 'Saving...' : 'Save Receipt Settings'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Printer Settings */}
          <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6 mb-6">
            <div className="flex items-center gap-2 mb-4">
              <Printer className="h-5 w-5 text-blue-600" />
              <h2 className="text-xl font-semibold text-gray-900">Printer Settings</h2>
            </div>

            {loadingSettings ? (
              <div className="text-gray-600">Loading printer settings...</div>
            ) : (
              <form onSubmit={handleShopSettingsSubmit} className="space-y-4">
                <div>
                  <label htmlFor="printerName" className="block text-sm font-medium text-gray-700 mb-2">
                    Printer Name
                  </label>
                  <input
                    type="text"
                    id="printerName"
                    value={shopSettings.printerName}
                    onChange={(e) => setShopSettings({ ...shopSettings, printerName: e.target.value })}
                    placeholder="Enter printer name (e.g., Thermal Printer, HP LaserJet)"
                    disabled={savingSettings}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all disabled:bg-gray-50 disabled:cursor-not-allowed"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Enter the name of your default printer. This will be used as a preference when printing receipts.
                  </p>
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="autoPrint"
                    checked={shopSettings.autoPrint}
                    onChange={(e) => setShopSettings({ ...shopSettings, autoPrint: e.target.checked })}
                    disabled={savingSettings}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 disabled:cursor-not-allowed"
                  />
                  <label htmlFor="autoPrint" className="ml-2 text-sm text-gray-700">
                    Auto-print receipts after sale completion
                  </label>
                </div>

                <div className="pt-4">
                  <button
                    type="submit"
                    disabled={savingSettings}
                    className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {savingSettings ? 'Saving...' : 'Save Printer Settings'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </>
      )}
    </div>
  )
}
