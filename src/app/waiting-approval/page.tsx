'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import Link from 'next/link'

interface OrganizationStatus {
  id: string
  name: string
  status: 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'INACTIVE'
  createdAt: string
  approvedAt?: string | null
  rejectionReason?: string | null
  suspensionReason?: string | null
}

export default function WaitingApprovalPage() {
  const router = useRouter()
  const { user, refreshUser } = useAuth()
  const [orgStatus, setOrgStatus] = useState<OrganizationStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchStatus()
    // Poll every 30 seconds
    const interval = setInterval(fetchStatus, 30000)
    return () => clearInterval(interval)
  }, [])

  // Redirect if organization is approved
  useEffect(() => {
    if (orgStatus?.status === 'ACTIVE') {
      setTimeout(() => {
        router.push('/org')
        router.refresh()
      }, 3000)
    }
  }, [orgStatus, router])

  async function fetchStatus() {
    try {
      const response = await fetch('/api/org/status')
      if (!response.ok) {
        throw new Error('Failed to fetch status')
      }
      const data = await response.json()
      setOrgStatus(data.organization)
    } catch (err) {
      setError('Failed to load status')
      console.error('Status fetch error:', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="w-full min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  if (orgStatus?.status === 'ACTIVE') {
    return (
      <div className="w-full min-h-screen flex flex-col md:flex-row">
        <div className="flex-1 bg-gradient-to-br from-slate-900 via-blue-900 to-orange-600 flex items-center justify-center p-8 md:p-12">
          <div className="text-white max-w-lg text-center md:text-left">
            <h1 className="text-4xl md:text-6xl font-bold mb-6 md:mb-8 leading-tight">
              Your organization has been approved!
            </h1>
            <p className="text-lg md:text-xl text-blue-100 mb-4">
              Welcome to CartPOS
            </p>
            <p className="text-base md:text-lg text-blue-200">
              Redirecting you to your dashboard...
            </p>
          </div>
        </div>
        <div className="flex-1 bg-gray-50 flex items-center justify-center p-8 md:p-12">
          <div className="w-full max-w-md text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-green-500 rounded-full mb-4">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-3xl font-bold text-gray-900 mb-2">Approved!</h2>
            <p className="text-gray-600 mb-6">
              Your organization &quot;{orgStatus.name}&quot; has been approved.
            </p>
            <Link
              href="/org"
              className="inline-block w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold py-3 px-4 rounded-lg transition-colors duration-200"
            >
              Go to Dashboard
            </Link>
          </div>
        </div>
      </div>
    )
  }

  if (orgStatus?.status === 'SUSPENDED') {
    return (
      <div className="w-full min-h-screen flex flex-col md:flex-row">
        <div className="flex-1 bg-gradient-to-br from-slate-900 via-blue-900 to-orange-600 flex items-center justify-center p-8 md:p-12">
          <div className="text-white max-w-lg text-center md:text-left">
            <h1 className="text-4xl md:text-6xl font-bold mb-6 md:mb-8 leading-tight">
              Organization Suspended
            </h1>
            <p className="text-lg md:text-xl text-blue-100 mb-4">
              Your organization access has been suspended
            </p>
          </div>
        </div>
        <div className="flex-1 bg-gray-50 flex items-center justify-center p-8 md:p-12">
          <div className="w-full max-w-md">
            <div className="bg-white p-6 rounded-lg border border-red-200">
              <div className="text-center mb-6">
                <div className="inline-flex items-center justify-center w-12 h-12 bg-red-100 rounded-full mb-4">
                  <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Suspended</h2>
                <p className="text-gray-600">
                  Your organization &quot;{orgStatus.name}&quot; has been suspended.
                </p>
              </div>
              {orgStatus.suspensionReason && (
                <div className="mb-4 p-3 bg-red-50 rounded-md">
                  <p className="text-sm text-red-800">{orgStatus.suspensionReason}</p>
                </div>
              )}
              <p className="text-sm text-gray-600 text-center">
                Please contact support for more information.
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (orgStatus?.status === 'INACTIVE') {
    return (
      <div className="w-full min-h-screen flex flex-col md:flex-row">
        <div className="flex-1 bg-gradient-to-br from-slate-900 via-blue-900 to-orange-600 flex items-center justify-center p-8 md:p-12">
          <div className="text-white max-w-lg text-center md:text-left">
            <h1 className="text-4xl md:text-6xl font-bold mb-6 md:mb-8 leading-tight">
              Registration Not Approved
            </h1>
            <p className="text-lg md:text-xl text-blue-100 mb-4">
              Your organization registration was not approved
            </p>
          </div>
        </div>
        <div className="flex-1 bg-gray-50 flex items-center justify-center p-8 md:p-12">
          <div className="w-full max-w-md">
            <div className="bg-white p-6 rounded-lg border border-red-200">
              <div className="text-center mb-6">
                <div className="inline-flex items-center justify-center w-12 h-12 bg-red-100 rounded-full mb-4">
                  <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Not Approved</h2>
                <p className="text-gray-600">
                  Your organization &quot;{orgStatus.name}&quot; registration was not approved.
                </p>
              </div>
              {orgStatus.rejectionReason && (
                <div className="mb-4 p-3 bg-red-50 rounded-md">
                  <p className="text-sm text-red-800">{orgStatus.rejectionReason}</p>
                </div>
              )}
              <p className="text-sm text-gray-600 text-center mb-4">
                Please contact support if you have questions.
              </p>
              <Link
                href="/signup"
                className="block w-full text-center bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg transition-colors duration-200"
              >
                Register Again
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // PENDING status (default)
  return (
    <div className="w-full min-h-screen flex flex-col md:flex-row">
      <div className="flex-1 bg-gradient-to-br from-slate-900 via-blue-900 to-orange-600 flex items-center justify-center p-8 md:p-12">
        <div className="text-white max-w-lg text-center md:text-left">
          <h1 className="text-4xl md:text-6xl font-bold mb-6 md:mb-8 leading-tight">
            Your request is under review
          </h1>
          <p className="text-lg md:text-xl text-blue-100 mb-4">
            We&apos;re reviewing your organization registration
          </p>
          <p className="text-base md:text-lg text-blue-200">
            A platform admin will review your request shortly. You&apos;ll be notified once your organization is approved.
          </p>
        </div>
      </div>

      <div className="flex-1 bg-gray-50 flex items-center justify-center p-8 md:p-12">
        <div className="w-full max-w-md">
          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-100 rounded-full mb-4">
                <svg className="w-6 h-6 text-blue-600 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Pending Approval</h2>
              <p className="text-gray-600">
                Your organization &quot;{orgStatus?.name || 'Unknown'}&quot; is waiting for admin approval.
              </p>
            </div>

            {orgStatus && (
              <div className="mb-6 space-y-2 text-sm text-gray-600">
                <div className="flex justify-between">
                  <span>Submitted:</span>
                  <span>{new Date(orgStatus.createdAt).toLocaleDateString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>Status:</span>
                  <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-xs font-medium">
                    {orgStatus.status}
                  </span>
                </div>
              </div>
            )}

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            <div className="space-y-3">
              <button
                onClick={fetchStatus}
                disabled={loading}
                className="w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Checking...' : 'Refresh Status'}
              </button>
              <Link
                href="/login"
                className="block w-full text-center text-blue-600 hover:text-blue-700 font-semibold py-2"
              >
                Back to Login
              </Link>
            </div>

            <p className="mt-6 text-xs text-gray-500 text-center">
              This page will automatically refresh every 30 seconds. You can also refresh manually.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

