'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { useAuth } from '@/contexts/AuthContext'
import { useLanguage } from '@/contexts/LanguageContext'
import { Settings as SettingsIcon, Lock, User, Mail, Phone, CreditCard, Printer, Globe, SlidersHorizontal } from 'lucide-react'
import { formatCNIC } from '@/lib/validation'
import { presetForType } from '@/lib/domain/business-presets'
import { COMMON_TIMEZONES } from '@/lib/utils/timezone'
import { validatePassword } from '@/lib/validation/password'
import { PasswordStrength } from '@/components/ui/PasswordStrength'

export default function SettingsPage() {
  const { user, refreshUser } = useAuth()
  const { language, setLanguage } = useLanguage()
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
  // Two-step verification (opt-in email 2FA)
  const [twoFAEnabled, setTwoFAEnabled] = useState(false)
  const [twoFASaving, setTwoFASaving] = useState(false)
  
  // Shop settings state (for STORE_MANAGER only)
  const [shopSettings, setShopSettings] = useState({
    printerName: '',
    autoPrint: false,
    logoUrl: null as string | null,
    receiptHeaderDisplay: 'NAME_ONLY' as 'NAME_ONLY' | 'LOGO_ONLY' | 'BOTH',
    cardFeePercent: 0,
    allowCardFeeOverride: false,
    timezone: 'Asia/Karachi',
    // Business-type feature flags
    enableQuotations: true,
    enableServiceCharge: false,
    serviceChargePercent: 0,
    allowServiceChargeOverride: true,
    enableDeliveryCharge: false,
    deliveryChargeMode: 'FIXED' as 'FIXED' | 'PERCENT',
    deliveryChargeDefault: 0,
    deliveryChargePercent: 0,
    removeServiceChargeOnDelivery: true,
    enableUnitSplitting: false,
    enableTradePricing: true,
    batchExpiry: false,
  })
  // Shop's business type (drives which feature sections show). Null until loaded.
  const [businessType, setBusinessType] = useState<string | null>(null)
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

  // Load current 2FA preference.
  useEffect(() => {
    fetch('/api/me')
      .then((r) => r.json())
      .then((d) => {
        if (typeof d?.user?.twoFactorEnabled === 'boolean') setTwoFAEnabled(d.user.twoFactorEnabled)
      })
      .catch(() => {})
  }, [])

  async function toggleTwoFA(next: boolean) {
    setTwoFASaving(true)
    setError('')
    setSuccess('')
    try {
      const res = await fetch('/api/me/two-factor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: next }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to update')
      setTwoFAEnabled(next)
      setSuccess(next ? 'Two-step verification enabled.' : 'Two-step verification disabled.')
    } catch (e: any) {
      setError(e.message || 'Failed to update two-step verification')
    } finally {
      setTwoFASaving(false)
    }
  }

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
            cardFeePercent: Number(data.settings?.cardFeePercent || 0),
            allowCardFeeOverride: Boolean(data.settings?.allowCardFeeOverride || false),
            timezone: data.settings?.timezone || 'Asia/Karachi',
            enableQuotations: data.settings?.enableQuotations !== false,
            enableServiceCharge: Boolean(data.settings?.enableServiceCharge),
            serviceChargePercent: Number(data.settings?.serviceChargePercent || 0),
            allowServiceChargeOverride: data.settings?.allowServiceChargeOverride !== false,
            enableDeliveryCharge: Boolean(data.settings?.enableDeliveryCharge),
            deliveryChargeMode: (data.settings?.deliveryChargeMode === 'PERCENT' ? 'PERCENT' : 'FIXED'),
            deliveryChargeDefault: Number(data.settings?.deliveryChargeDefault || 0),
            deliveryChargePercent: Number(data.settings?.deliveryChargePercent || 0),
            removeServiceChargeOnDelivery: data.settings?.removeServiceChargeOnDelivery !== false,
            enableUnitSplitting: Boolean(data.settings?.enableUnitSplitting),
            enableTradePricing: data.settings?.enableTradePricing !== false,
            batchExpiry: Boolean(data.settings?.featureConfig?.batchExpiry),
          })
          setBusinessType(data.businessType ?? null)
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

    // Validation (strict policy)
    const pw = validatePassword(passwordData.newPassword)
    if (!pw.ok) {
      setError(`Password must: ${pw.errors.join('; ')}.`)
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
          cardFeePercent: shopSettings.cardFeePercent,
          allowCardFeeOverride: shopSettings.allowCardFeeOverride,
          timezone: shopSettings.timezone,
          enableQuotations: shopSettings.enableQuotations,
          enableServiceCharge: shopSettings.enableServiceCharge,
          serviceChargePercent: shopSettings.serviceChargePercent,
          allowServiceChargeOverride: shopSettings.allowServiceChargeOverride,
          enableDeliveryCharge: shopSettings.enableDeliveryCharge,
          deliveryChargeMode: shopSettings.deliveryChargeMode,
          deliveryChargeDefault: shopSettings.deliveryChargeDefault,
          deliveryChargePercent: shopSettings.deliveryChargePercent,
          removeServiceChargeOnDelivery: shopSettings.removeServiceChargeOnDelivery,
          enableUnitSplitting: shopSettings.enableUnitSplitting,
          enableTradePricing: shopSettings.enableTradePricing,
          featureConfig: { batchExpiry: shopSettings.batchExpiry },
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update shop settings')
      }

      setSettingsSuccess('Settings updated successfully')
      // Refresh session so feature flags (nav visibility, POS toggles) reflect the change.
      await refreshUser()
      setTimeout(() => setSettingsSuccess(''), 3000)
    } catch (err: any) {
      setSettingsError(err.message || 'Failed to update shop settings')
    } finally {
      setSavingSettings(false)
    }
  }

  // Which feature sections to show is driven by the shop's business type (its preset
  // capabilities), OR-ed with whatever is currently enabled so a feature stays visible
  // after a manager toggles it on. This is the general per-business-type model.
  const caps = presetForType(businessType as any)
  const showQuotations = caps.enableQuotations || shopSettings.enableQuotations
  const showRestaurantCharges =
    caps.enableServiceCharge || caps.enableDeliveryCharge ||
    shopSettings.enableServiceCharge || shopSettings.enableDeliveryCharge
  const showUnitSplitting = caps.enableUnitSplitting || shopSettings.enableUnitSplitting
  const showTradePricing = caps.enableTradePricing || shopSettings.enableTradePricing
  const showBatchExpiry = caps.batchExpiry || shopSettings.batchExpiry
  const hasAnyFeature = showQuotations || showRestaurantCharges || showUnitSplitting || showTradePricing || showBatchExpiry

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
                minLength={10}
                disabled={saving}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all disabled:bg-gray-50 disabled:cursor-not-allowed"
              />
              <PasswordStrength value={passwordData.newPassword} />
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
                minLength={10}
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

      {/* Two-Step Verification - available to every user */}
      <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-start gap-2 pr-4">
            <Lock className="h-5 w-5 text-blue-600 mt-0.5" />
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Two-Step Verification</h2>
              <p className="text-sm text-gray-500 mt-1">
                When on, signing in requires a 6-digit code emailed to you - extra protection if your
                password is ever leaked.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => toggleTwoFA(!twoFAEnabled)}
            disabled={twoFASaving}
            role="switch"
            aria-checked={twoFAEnabled}
            className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
              twoFAEnabled ? 'bg-blue-600' : 'bg-gray-300'
            }`}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                twoFAEnabled ? 'translate-x-5' : 'translate-x-0.5'
              }`}
            />
          </button>
        </div>
        <p className="mt-3 text-sm font-medium">
          Status:{' '}
          <span className={twoFAEnabled ? 'text-green-600' : 'text-gray-500'}>
            {twoFAEnabled ? 'Enabled' : 'Disabled'}
          </span>
        </p>
      </div>

      {/* Language - available to every user */}
      <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Globe className="h-5 w-5 text-blue-600" />
          <h2 className="text-xl font-semibold text-gray-900">Language</h2>
        </div>
        <p className="text-sm text-gray-500 mb-3">Choose the display language for the app.</p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setLanguage('en')}
            className={`px-4 py-2 rounded-lg border font-medium ${language === 'en' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}
          >
            English
          </button>
          <button
            type="button"
            onClick={() => setLanguage('ur')}
            className={`px-4 py-2 rounded-lg border font-medium ${language === 'ur' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}
          >
            اردو
          </button>
        </div>
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

                {/* Timezone */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Shop Timezone
                  </label>
                  <select
                    value={shopSettings.timezone}
                    onChange={(e) => setShopSettings({ ...shopSettings, timezone: e.target.value })}
                    disabled={savingSettings}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all disabled:bg-gray-50 disabled:cursor-not-allowed"
                  >
                    {COMMON_TIMEZONES.map((tz) => (
                      <option key={tz.value} value={tz.value}>
                        {tz.label}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-gray-500">
                    Used to decide what counts as &quot;today&quot; on dashboards and reports.
                  </p>
                </div>

                {/* Card Payment Fee Settings */}
                <div className="mt-4 space-y-3">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Card Payment Fee (%)
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step={0.01}
                      value={shopSettings.cardFeePercent}
                      onChange={(e) =>
                        setShopSettings({
                          ...shopSettings,
                          cardFeePercent: Number(e.target.value) || 0,
                        })
                      }
                      disabled={savingSettings}
                      className="w-32 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all disabled:bg-gray-50 disabled:cursor-not-allowed text-right"
                    />
                    <span className="text-sm text-gray-600">
                      Applied on total after discount when payment method is CARD. 0 = no fee.
                    </span>
                  </div>

                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="allowCardFeeOverride"
                      checked={shopSettings.allowCardFeeOverride}
                      onChange={(e) =>
                        setShopSettings({
                          ...shopSettings,
                          allowCardFeeOverride: e.target.checked,
                        })
                      }
                      disabled={savingSettings}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 disabled:cursor-not-allowed"
                    />
                    <label htmlFor="allowCardFeeOverride" className="ml-2 text-sm text-gray-700">
                      Allow cashier to change card fee % per sale
                    </label>
                  </div>
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

          {/* Business Features (shown only when the shop's business type has them) */}
          {isStoreManager && hasAnyFeature && (
            <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6 mb-6">
              <div className="flex items-center gap-2 mb-4">
                <SlidersHorizontal className="h-5 w-5 text-blue-600" />
                <h2 className="text-xl font-semibold text-gray-900">Business Features</h2>
              </div>
              {loadingSettings ? (
                <div className="text-gray-600">Loading features...</div>
              ) : (
                <div className="space-y-5">
                  {/* Quotations */}
                  {showQuotations && (
                    <div className="flex items-start">
                      <input
                        type="checkbox"
                        id="enableQuotations"
                        checked={shopSettings.enableQuotations}
                        onChange={(e) => setShopSettings({ ...shopSettings, enableQuotations: e.target.checked })}
                        disabled={savingSettings}
                        className="mt-0.5 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <label htmlFor="enableQuotations" className="ml-2 text-sm text-gray-700">
                        <span className="font-medium">Quotations</span>
                        <span className="block text-xs text-gray-500">Create price estimates that convert to sales (hardware, electric, wholesale).</span>
                      </label>
                    </div>
                  )}

                  {/* Trade pricing (Retail/Trade toggle at POS) */}
                  {showTradePricing && (
                    <div className="flex items-start">
                      <input
                        type="checkbox"
                        id="enableTradePricing"
                        checked={shopSettings.enableTradePricing}
                        onChange={(e) => setShopSettings({ ...shopSettings, enableTradePricing: e.target.checked })}
                        disabled={savingSettings}
                        className="mt-0.5 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <label htmlFor="enableTradePricing" className="ml-2 text-sm text-gray-700">
                        <span className="font-medium">Trade pricing</span>
                        <span className="block text-xs text-gray-500">Show the Retail / Trade price toggle at checkout (wholesale, hardware, electric).</span>
                      </label>
                    </div>
                  )}

                  {/* Unit splitting (pharmacy) */}
                  {showUnitSplitting && (
                    <div className="flex items-start">
                      <input
                        type="checkbox"
                        id="enableUnitSplitting"
                        checked={shopSettings.enableUnitSplitting}
                        onChange={(e) => setShopSettings({ ...shopSettings, enableUnitSplitting: e.target.checked })}
                        disabled={savingSettings}
                        className="mt-0.5 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <label htmlFor="enableUnitSplitting" className="ml-2 text-sm text-gray-700">
                        <span className="font-medium">Multi-level packaging</span>
                        <span className="block text-xs text-gray-500">Sell at different pack levels (carton / box / loose unit) e.g. pharmacy.</span>
                      </label>
                    </div>
                  )}

                  {/* Batch & expiry tracking (pharmacy / perishables) */}
                  {showBatchExpiry && (
                    <div className="flex items-start">
                      <input
                        type="checkbox"
                        id="batchExpiry"
                        checked={shopSettings.batchExpiry}
                        onChange={(e) => setShopSettings({ ...shopSettings, batchExpiry: e.target.checked })}
                        disabled={savingSettings}
                        className="mt-0.5 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <label htmlFor="batchExpiry" className="ml-2 text-sm text-gray-700">
                        <span className="font-medium">Batch &amp; expiry tracking</span>
                        <span className="block text-xs text-gray-500">Record batch number + expiry at stock-in, sell earliest-expiry first, alert before expiry.</span>
                      </label>
                    </div>
                  )}

                  {/* Restaurant: service + delivery charges */}
                  {showRestaurantCharges && (
                    <div className="space-y-4 rounded-lg border border-gray-200 p-4">
                      <p className="text-sm font-semibold text-gray-900">Restaurant charges</p>

                      {/* Service charge */}
                      <div className="flex items-start">
                        <input
                          type="checkbox"
                          id="enableServiceCharge"
                          checked={shopSettings.enableServiceCharge}
                          onChange={(e) => setShopSettings({ ...shopSettings, enableServiceCharge: e.target.checked })}
                          disabled={savingSettings}
                          className="mt-0.5 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <label htmlFor="enableServiceCharge" className="ml-2 text-sm text-gray-700">
                          <span className="font-medium">Service charge</span>
                          <span className="block text-xs text-gray-500">Added to dine-in bills.</span>
                        </label>
                      </div>
                      {shopSettings.enableServiceCharge && (
                        <div className="ml-6 space-y-3">
                          <div className="flex items-center gap-3">
                            <input
                              type="number"
                              min={0}
                              max={100}
                              step={0.01}
                              value={shopSettings.serviceChargePercent}
                              onChange={(e) => setShopSettings({ ...shopSettings, serviceChargePercent: Number(e.target.value) || 0 })}
                              disabled={savingSettings}
                              className="w-28 px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-right"
                            />
                            <span className="text-sm text-gray-600">% of bill</span>
                          </div>
                          <div className="flex items-center">
                            <input
                              type="checkbox"
                              id="allowServiceChargeOverride"
                              checked={shopSettings.allowServiceChargeOverride}
                              onChange={(e) => setShopSettings({ ...shopSettings, allowServiceChargeOverride: e.target.checked })}
                              disabled={savingSettings}
                              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                            />
                            <label htmlFor="allowServiceChargeOverride" className="ml-2 text-sm text-gray-700">
                              Allow cashier to change service charge per bill
                            </label>
                          </div>
                        </div>
                      )}

                      {/* Delivery charge */}
                      <div className="flex items-start">
                        <input
                          type="checkbox"
                          id="enableDeliveryCharge"
                          checked={shopSettings.enableDeliveryCharge}
                          onChange={(e) => setShopSettings({ ...shopSettings, enableDeliveryCharge: e.target.checked })}
                          disabled={savingSettings}
                          className="mt-0.5 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <label htmlFor="enableDeliveryCharge" className="ml-2 text-sm text-gray-700">
                          <span className="font-medium">Delivery charge</span>
                          <span className="block text-xs text-gray-500">Added to delivery orders.</span>
                        </label>
                      </div>
                      {shopSettings.enableDeliveryCharge && (
                        <div className="ml-6 space-y-3">
                          <div className="flex items-center gap-2">
                            {(['FIXED', 'PERCENT'] as const).map((mode) => (
                              <button
                                key={mode}
                                type="button"
                                onClick={() => setShopSettings({ ...shopSettings, deliveryChargeMode: mode })}
                                disabled={savingSettings}
                                className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                                  shopSettings.deliveryChargeMode === mode
                                    ? 'bg-blue-600 text-white border-blue-600'
                                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                                }`}
                              >
                                {mode === 'FIXED' ? 'Fixed amount' : 'Percentage'}
                              </button>
                            ))}
                          </div>
                          {shopSettings.deliveryChargeMode === 'FIXED' ? (
                            <div className="flex items-center gap-3">
                              <input
                                type="number"
                                min={0}
                                step={1}
                                value={shopSettings.deliveryChargeDefault}
                                onChange={(e) => setShopSettings({ ...shopSettings, deliveryChargeDefault: Number(e.target.value) || 0 })}
                                disabled={savingSettings}
                                className="w-32 px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-right"
                              />
                              <span className="text-sm text-gray-600">Rs default (editable per order)</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-3">
                              <input
                                type="number"
                                min={0}
                                max={100}
                                step={0.01}
                                value={shopSettings.deliveryChargePercent}
                                onChange={(e) => setShopSettings({ ...shopSettings, deliveryChargePercent: Number(e.target.value) || 0 })}
                                disabled={savingSettings}
                                className="w-28 px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-right"
                              />
                              <span className="text-sm text-gray-600">% of bill</span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* SC vs delivery rule */}
                      {shopSettings.enableServiceCharge && shopSettings.enableDeliveryCharge && (
                        <div className="flex items-center">
                          <input
                            type="checkbox"
                            id="removeServiceChargeOnDelivery"
                            checked={shopSettings.removeServiceChargeOnDelivery}
                            onChange={(e) => setShopSettings({ ...shopSettings, removeServiceChargeOnDelivery: e.target.checked })}
                            disabled={savingSettings}
                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                          />
                          <label htmlFor="removeServiceChargeOnDelivery" className="ml-2 text-sm text-gray-700">
                            Drop the service charge on delivery orders
                          </label>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="pt-4 border-t border-gray-200">
                    <button
                      type="button"
                      onClick={handleShopSettingsSubmit}
                      disabled={savingSettings}
                      className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {savingSettings ? 'Saving...' : 'Save Features'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

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
