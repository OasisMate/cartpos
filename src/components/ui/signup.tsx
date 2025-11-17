'use client'

import { useState, FormEvent, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Eye, EyeOff } from 'lucide-react'
import { formatCNIC } from '@/lib/validation'

export default function Signup() {
  const router = useRouter()
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [formData, setFormData] = useState({
    // User fields
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    cnic: '',
    isWhatsApp: false,
    password: '',
    confirmPassword: '',
    // Organization fields
    organizationName: '',
    legalName: '',
    city: '',
    addressLine1: '',
    addressLine2: '',
    ntn: '',
    strn: '',
    orgPhone: '',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const prevOrgNameRef = useRef<string>('')

  // Auto-fill legal name from organization name
  // Only auto-fill if legalName is empty or was previously auto-filled (matches old org name)
  useEffect(() => {
    const prevOrgName = prevOrgNameRef.current
    const currentOrgName = formData.organizationName

    // Only update if organization name changed
    if (currentOrgName !== prevOrgName) {
      setFormData((prev) => {
        // If legal name is empty or matches the previous org name (was auto-filled), update it
        if (!prev.legalName || prev.legalName === prevOrgName) {
          return { ...prev, legalName: currentOrgName }
        }
        return prev
      })
      prevOrgNameRef.current = currentOrgName
    }
  }, [formData.organizationName])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target
    const checked = (e.target as HTMLInputElement).checked

    if (name === 'cnic') {
      // Format CNIC as user types (XXXXX-XXXXXXX-X)
      const digits = value.replace(/\D/g, '')
      let formatted = digits
      if (digits.length > 5) {
        formatted = `${digits.slice(0, 5)}-${digits.slice(5)}`
      }
      if (digits.length > 12) {
        formatted = `${digits.slice(0, 5)}-${digits.slice(5, 12)}-${digits.slice(12, 13)}`
      }
      setFormData({
        ...formData,
        [name]: formatted,
      })
    } else {
      setFormData({
        ...formData,
        [name]: type === 'checkbox' ? checked : value,
      })
    }
    setError('')
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')

    // Validate required fields
    if (
      !formData.firstName ||
      !formData.lastName ||
      !formData.email ||
      !formData.phone ||
      !formData.cnic ||
      !formData.password ||
      !formData.organizationName ||
      !formData.city
    ) {
      setError('Please fill all required fields')
      return
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }

    setLoading(true)

    try {
      const response = await fetch('/api/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: formData.firstName,
          lastName: formData.lastName,
          email: formData.email,
          phone: formData.phone,
          cnic: formData.cnic,
          isWhatsApp: formData.isWhatsApp,
          password: formData.password,
          organizationName: formData.organizationName,
          legalName: formData.legalName || formData.organizationName,
          city: formData.city,
          addressLine1: formData.addressLine1 || undefined,
          addressLine2: formData.addressLine2 || undefined,
          ntn: formData.ntn || undefined,
          strn: formData.strn || undefined,
          orgPhone: formData.orgPhone || undefined,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Signup failed')
        setLoading(false)
        return
      }

      setSuccess(true)
      setTimeout(() => {
        router.push('/waiting-approval')
      }, 2000)
    } catch (err) {
      setError('An error occurred. Please try again.')
      setLoading(false)
    }
  }

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword)
  }

  const toggleConfirmPasswordVisibility = () => {
    setShowConfirmPassword(!showConfirmPassword)
  }

  if (success) {
    return (
      <div className="w-full min-h-screen flex flex-col md:flex-row">
        {/* Left side - Hero section */}
        <div className="flex-1 bg-gradient-to-br from-slate-900 via-blue-900 to-orange-600 flex items-center justify-center p-8 md:p-12">
          <div className="text-white max-w-lg text-center md:text-left">
            <h1 className="text-4xl md:text-6xl font-bold mb-6 md:mb-8 leading-tight">
              Request submitted successfully
            </h1>
            <p className="text-lg md:text-xl text-blue-100 mb-4">
              Your organization request is pending approval
            </p>
            <p className="text-base md:text-lg text-blue-200">
              A platform admin will review your request. You&apos;ll be able to log in once your organization is approved.
            </p>
          </div>
        </div>

        {/* Right side - Success message */}
        <div className="flex-1 bg-gray-50 flex items-center justify-center p-8 md:p-12">
          <div className="w-full max-w-md">
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-500 rounded-lg mb-4">
                <div className="w-6 h-6 bg-white rounded-sm relative">
                  <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-2 h-3 bg-orange-500 rounded-b-sm"></div>
                  <div className="absolute bottom-3 left-1/2 transform -translate-x-1/2 w-1 h-2 bg-red-500 rounded-t-sm"></div>
                </div>
              </div>
              <h2 className="text-3xl font-bold text-gray-900 mb-2">Request Submitted</h2>
              <p className="text-gray-600">
                Your organization registration is pending admin approval
              </p>
            </div>

            <Link
              href="/waiting-approval"
              className="block w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold py-3 px-4 rounded-lg transition-colors duration-200 focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 text-center"
            >
              View Status
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full min-h-screen flex flex-col lg:flex-row overflow-y-auto">
      {/* Left side - Hero section (40%) */}
      <div className="hidden lg:flex w-full lg:w-2/5 bg-gradient-to-br from-slate-900 via-blue-900 to-orange-600 items-center justify-center p-6">
        <div className="text-white max-w-lg text-center lg:text-left">
          <h1 className="text-3xl lg:text-4xl font-bold mb-4 leading-tight">
            Start managing your retail shop today
          </h1>
          <p className="text-base lg:text-lg text-blue-100 mb-2">
            CartPOS - Offline-first Point of Sale system
          </p>
          <p className="text-sm lg:text-base text-blue-200">
            Register your organization to get started with fast billing, stock control, udhaar tracking, and daily summaries.
          </p>
        </div>
      </div>

      {/* Right side - Signup form (60%) */}
      <div className="w-full lg:w-3/5 bg-gray-50 flex items-start justify-center p-4 md:p-6 overflow-y-auto">
        <div className="w-full max-w-6xl">
          {/* Logo/Icon */}
          <div className="text-center mb-3">
            <div className="inline-flex items-center justify-center w-10 h-10 bg-blue-500 rounded-lg mb-2">
              <div className="w-5 h-5 bg-white rounded-sm relative">
                <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-2 h-3 bg-orange-500 rounded-b-sm"></div>
                <div className="absolute bottom-3 left-1/2 transform -translate-x-1/2 w-1 h-2 bg-red-500 rounded-t-sm"></div>
              </div>
            </div>
            <h2 className="text-xl font-bold text-gray-900">
              Create Organization
            </h2>
          </div>

          {/* Error message */}
          {error && (
            <div className="mb-2 rounded-md bg-red-50 border border-red-200 p-2">
              <div className="text-sm text-red-600">{error}</div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-2.5">
            {/* Contact Information Section */}
            <div className="bg-white p-3 rounded-lg border border-gray-200">
              <h3 className="text-sm font-semibold text-gray-900 mb-2">Contact Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
                <div>
                  <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-1">
                    First Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="firstName"
                    name="firstName"
                    value={formData.firstName}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                    placeholder="First name"
                    required
                    disabled={loading}
                  />
                </div>
                <div>
                  <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-1">
                    Last Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="lastName"
                    name="lastName"
                    value={formData.lastName}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                    placeholder="Last name"
                    required
                    disabled={loading}
                  />
                </div>
                <div>
                  <label htmlFor="cnic" className="block text-sm font-medium text-gray-700 mb-1">
                    CNIC <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="cnic"
                    name="cnic"
                    value={formData.cnic}
                    onChange={handleInputChange}
                    maxLength={15}
                    className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                    placeholder="XXXXX-XXXXXXX-X"
                    required
                    disabled={loading}
                  />
                </div>
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                    Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                    placeholder="your@email.com"
                    required
                    disabled={loading}
                    autoComplete="email"
                  />
                </div>
                <div>
                  <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
                    Phone <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    id="phone"
                    name="phone"
                    value={formData.phone}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                    placeholder="+92XXXXXXXXXX"
                    required
                    disabled={loading}
                    autoComplete="tel"
                  />
                </div>
                <div className="flex items-end">
                  <label className="flex items-center cursor-pointer group w-full">
                    <div className="relative flex-shrink-0">
                      <input
                        type="checkbox"
                        name="isWhatsApp"
                        checked={formData.isWhatsApp}
                        onChange={handleInputChange}
                        className="sr-only"
                        disabled={loading}
                      />
                      <div
                        className={`w-11 h-6 rounded-full transition-colors duration-200 ease-in-out relative ${
                          formData.isWhatsApp
                            ? 'bg-green-500'
                            : 'bg-gray-300 group-hover:bg-gray-400'
                        } ${loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                      >
                        <div
                          className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-md transform transition-transform duration-200 ease-in-out ${
                            formData.isWhatsApp ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </div>
                    </div>
                    <span className="ml-3 text-sm text-gray-700 font-medium">
                      This number is on WhatsApp
                    </span>
                  </label>
                </div>
              </div>
            </div>

            {/* Organization Information Section */}
            <div className="bg-white p-3 rounded-lg border border-gray-200">
              <h3 className="text-sm font-semibold text-gray-900 mb-2">Organization Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
                <div className="md:col-span-2">
                  <label htmlFor="organizationName" className="block text-sm font-medium text-gray-700 mb-1">
                    Business/Shop Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="organizationName"
                    name="organizationName"
                    value={formData.organizationName}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                    placeholder="Your shop name"
                    required
                    disabled={loading}
                  />
                </div>
                <div>
                  <label htmlFor="legalName" className="block text-sm font-medium text-gray-700 mb-1">
                    Legal Name (Optional)
                  </label>
                  <input
                    type="text"
                    id="legalName"
                    name="legalName"
                    value={formData.legalName}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                    placeholder="Legal name (if different)"
                    disabled={loading}
                  />
                </div>
                <div>
                  <label htmlFor="city" className="block text-sm font-medium text-gray-700 mb-1">
                    City <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="city"
                    name="city"
                    value={formData.city}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                    placeholder="City"
                    required
                    disabled={loading}
                  />
                </div>
                <div>
                  <label htmlFor="orgPhone" className="block text-sm font-medium text-gray-700 mb-1">
                    Org Phone (Optional)
                  </label>
                  <input
                    type="tel"
                    id="orgPhone"
                    name="orgPhone"
                    value={formData.orgPhone}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                    placeholder="+92XXXXXXXXXX"
                    disabled={loading}
                  />
                </div>
                <div className="md:col-span-2">
                  <label htmlFor="addressLine1" className="block text-sm font-medium text-gray-700 mb-1">
                    Address Line 1 (Optional)
                  </label>
                  <input
                    type="text"
                    id="addressLine1"
                    name="addressLine1"
                    value={formData.addressLine1}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                    placeholder="Street address"
                    disabled={loading}
                  />
                </div>
                <div>
                  <label htmlFor="addressLine2" className="block text-sm font-medium text-gray-700 mb-1">
                    Address Line 2 (Optional)
                  </label>
                  <input
                    type="text"
                    id="addressLine2"
                    name="addressLine2"
                    value={formData.addressLine2}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                    placeholder="Area, landmark"
                    disabled={loading}
                  />
                </div>
                <div>
                  <label htmlFor="ntn" className="block text-sm font-medium text-gray-700 mb-1">
                    NTN (Optional)
                  </label>
                  <input
                    type="text"
                    id="ntn"
                    name="ntn"
                    value={formData.ntn}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                    placeholder="National Tax Number"
                    disabled={loading}
                  />
                </div>
                <div>
                  <label htmlFor="strn" className="block text-sm font-medium text-gray-700 mb-1">
                    STRN (Optional)
                  </label>
                  <input
                    type="text"
                    id="strn"
                    name="strn"
                    value={formData.strn}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                    placeholder="Sales Tax Reg. Number"
                    disabled={loading}
                  />
                </div>
              </div>
            </div>

            {/* Password Section */}
            <div className="bg-white p-3 rounded-lg border border-gray-200">
              <h3 className="text-sm font-semibold text-gray-900 mb-2">Account Security</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                    Password <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      id="password"
                      name="password"
                      value={formData.password}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2.5 pr-10 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                      placeholder="Create a secure password"
                      required
                      disabled={loading}
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={togglePasswordVisibility}
                      className="absolute inset-y-0 right-0 flex items-center pr-2 text-gray-500 hover:text-gray-700 focus:outline-none"
                      disabled={loading}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                    Confirm Password <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      id="confirmPassword"
                      name="confirmPassword"
                      value={formData.confirmPassword}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2.5 pr-10 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                      placeholder="Confirm your password"
                      required
                      disabled={loading}
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={toggleConfirmPasswordVisibility}
                      className="absolute inset-y-0 right-0 flex items-center pr-2 text-gray-500 hover:text-gray-700 focus:outline-none"
                      disabled={loading}
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold py-2.5 px-4 rounded-lg transition-colors duration-200 focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              {loading ? 'Submitting...' : 'Create Organization'}
            </button>

            <div className="text-center text-sm">
              <span className="text-gray-600">Already have an account?</span>{' '}
              <Link href="/login" className="text-blue-600 hover:text-blue-700 font-semibold">
                Login
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
