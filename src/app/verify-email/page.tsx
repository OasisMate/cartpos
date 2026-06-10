'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'

type View = 'checking' | 'sent' | 'verified' | 'already' | 'expired' | 'invalid'

function VerifyEmailInner() {
  const params = useSearchParams()
  const token = params.get('token')
  const emailParam = params.get('email') || ''

  const [view, setView] = useState<View>(token ? 'checking' : 'sent')
  const [resendEmail, setResendEmail] = useState(emailParam)
  const [resendState, setResendState] = useState<'idle' | 'sending' | 'done'>('idle')

  useEffect(() => {
    if (!token) return
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/auth/verify-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        })
        const data = await res.json().catch(() => ({}))
        if (cancelled) return
        const status = data?.status as View
        setView(['verified', 'already', 'expired', 'invalid'].includes(status) ? status : 'invalid')
      } catch {
        if (!cancelled) setView('invalid')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [token])

  async function handleResend() {
    if (!resendEmail || resendState === 'sending') return
    setResendState('sending')
    try {
      await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resendEmail }),
      })
    } finally {
      setResendState('done')
    }
  }

  const ICONS = {
    success: (
      <div className="inline-flex items-center justify-center w-16 h-16 bg-green-500 rounded-full mb-4">
        <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      </div>
    ),
    mail: (
      <div className="inline-flex items-center justify-center w-16 h-16 bg-orange-100 rounded-full mb-4">
        <svg className="w-8 h-8 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      </div>
    ),
    error: (
      <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mb-4">
        <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </div>
    ),
  }

  let icon = ICONS.mail
  let heading = ''
  let lede = ''
  let body: React.ReactNode = null

  if (view === 'checking') {
    return (
      <div className="w-full max-w-md text-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mb-4" />
        <p className="text-gray-600">Verifying your email…</p>
      </div>
    )
  }

  if (view === 'verified' || view === 'already') {
    icon = ICONS.success
    heading = view === 'verified' ? 'Email verified!' : 'Already verified'
    lede =
      view === 'verified'
        ? 'Thanks for confirming your email.'
        : 'This email is already confirmed.'
    body = (
      <>
        <p className="text-gray-600 mb-6">
          Your account is now waiting for an administrator to review and approve it. We&apos;ll let you
          know once it&apos;s active — you can sign in after approval.
        </p>
        <Link
          href="/login"
          className="inline-block w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold py-3 px-4 rounded-lg transition-colors"
        >
          Go to Login
        </Link>
      </>
    )
  } else if (view === 'sent') {
    icon = ICONS.mail
    heading = 'Check your inbox'
    lede = 'We sent a verification link to your email.'
    body = (
      <>
        <div className="mb-4 p-3 bg-orange-50 border border-orange-100 rounded-md text-sm text-orange-800 text-left">
          Please verify within <strong>7 days</strong>. Unverified accounts are denied and removed after that.
        </div>
        <p className="text-sm text-gray-600 mb-3">Didn&apos;t get it? Check spam, or resend below.</p>
        <ResendBox
          email={resendEmail}
          setEmail={setResendEmail}
          state={resendState}
          onResend={handleResend}
        />
        <Link href="/login" className="block mt-4 text-orange-600 hover:text-orange-700 font-semibold">
          Back to Login
        </Link>
      </>
    )
  } else {
    // expired or invalid
    icon = ICONS.error
    heading = view === 'expired' ? 'Link expired' : 'Invalid link'
    lede =
      view === 'expired'
        ? 'This verification link has expired.'
        : 'This verification link is invalid or already used.'
    body = (
      <>
        <p className="text-sm text-gray-600 mb-3">Enter your email to get a fresh verification link.</p>
        <ResendBox
          email={resendEmail}
          setEmail={setResendEmail}
          state={resendState}
          onResend={handleResend}
        />
        <Link href="/login" className="block mt-4 text-orange-600 hover:text-orange-700 font-semibold">
          Back to Login
        </Link>
      </>
    )
  }

  return (
    <div className="w-full max-w-md text-center">
      {icon}
      <h2 className="text-3xl font-bold text-gray-900 mb-2">{heading}</h2>
      <p className="text-gray-600 mb-6">{lede}</p>
      {body}
    </div>
  )
}

function ResendBox({
  email,
  setEmail,
  state,
  onResend,
}: {
  email: string
  setEmail: (v: string) => void
  state: 'idle' | 'sending' | 'done'
  onResend: () => void
}) {
  if (state === 'done') {
    return (
      <div className="p-3 bg-green-50 border border-green-200 rounded-md text-sm text-green-800">
        If that account still needs verification, a new link is on its way. Check your inbox.
      </div>
    )
  }
  return (
    <div className="flex gap-2">
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="your@email.com"
        className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
      />
      <button
        onClick={onResend}
        disabled={!email || state === 'sending'}
        className="bg-orange-500 hover:bg-orange-600 text-white font-semibold px-4 py-2 rounded-lg text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {state === 'sending' ? 'Sending…' : 'Resend'}
      </button>
    </div>
  )
}

export default function VerifyEmailPage() {
  return (
    <div className="w-full min-h-screen flex flex-col md:flex-row">
      <div className="flex-1 bg-gradient-to-br from-slate-900 via-blue-900 to-orange-600 flex items-center justify-center p-8 md:p-12">
        <div className="text-white max-w-lg text-center md:text-left">
          <h1 className="text-4xl md:text-6xl font-bold mb-6 md:mb-8 leading-tight">
            One quick step
          </h1>
          <p className="text-lg md:text-xl text-blue-100">
            Confirm your email to secure your Cart POS account and continue to approval.
          </p>
        </div>
      </div>
      <div className="flex-1 bg-gray-50 flex items-center justify-center p-8 md:p-12">
        <Suspense fallback={<div className="text-gray-500">Loading…</div>}>
          <VerifyEmailInner />
        </Suspense>
      </div>
    </div>
  )
}
