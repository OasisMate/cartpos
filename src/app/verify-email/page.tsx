'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'

type View = 'checking' | 'sent' | 'verified' | 'already' | 'expired' | 'invalid'

function VerifyEmailInner() {
  const params = useSearchParams()
  const token = params.get('token')
  const emailParam = params.get('email') || ''

  const [view, setView] = useState<View>(token ? 'checking' : 'sent')
  const [email, setEmail] = useState(emailParam)
  const [resendState, setResendState] = useState<'idle' | 'sending' | 'done'>('idle')
  const [codeError, setCodeError] = useState('')
  const [verifyingCode, setVerifyingCode] = useState(false)

  // Auto-verify when arriving via the email link.
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

  async function submitCode(code: string) {
    if (!email) {
      setCodeError('Enter your email above first.')
      return
    }
    setVerifyingCode(true)
    setCodeError('')
    try {
      const res = await fetch('/api/auth/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code }),
      })
      const data = await res.json().catch(() => ({}))
      const status = data?.status as View
      if (status === 'verified' || status === 'already') {
        setView(status)
      } else if (status === 'expired') {
        setCodeError('That code has expired. Resend a new one below.')
      } else {
        setCodeError(data?.error || 'Invalid code. Please check and try again.')
      }
    } catch {
      setCodeError('Something went wrong. Please try again.')
    } finally {
      setVerifyingCode(false)
    }
  }

  async function handleResend() {
    if (!email || resendState === 'sending') return
    setResendState('sending')
    try {
      await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
    } finally {
      setResendState('done')
    }
  }

  if (view === 'checking') {
    return (
      <div className="w-full max-w-md text-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mb-4" />
        <p className="text-gray-600">Verifying your email…</p>
      </div>
    )
  }

  if (view === 'verified' || view === 'already') {
    return (
      <div className="w-full max-w-md text-center">
        <SuccessIcon />
        <h2 className="text-3xl font-bold text-gray-900 mb-2">
          {view === 'verified' ? 'Email verified!' : 'Already verified'}
        </h2>
        <p className="text-gray-600 mb-6">
          Your account is now waiting for an administrator to review and approve it. You can sign in
          once it&apos;s approved.
        </p>
        <Link
          href="/login"
          className="inline-block w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold py-3 px-4 rounded-lg transition-colors"
        >
          Go to Login
        </Link>
      </div>
    )
  }

  const isError = view === 'expired' || view === 'invalid'

  return (
    <div className="w-full max-w-md text-center">
      {isError ? <ErrorIcon /> : <MailIcon />}
      <h2 className="text-3xl font-bold text-gray-900 mb-2">
        {view === 'expired' ? 'Link expired' : view === 'invalid' ? 'Invalid link' : 'Check your inbox'}
      </h2>
      <p className="text-gray-600 mb-5">
        {view === 'expired'
          ? 'This verification link has expired — use the code from a fresh email, or resend below.'
          : view === 'invalid'
          ? 'This link is invalid or already used. Enter your code below, or resend a new one.'
          : 'We sent a verification link and a 6-digit code to your email.'}
      </p>

      {!isError && (
        <div className="mb-4 p-3 bg-orange-50 border border-orange-100 rounded-md text-sm text-orange-800 text-left">
          Please verify within <strong>7 days</strong>. Unverified accounts are denied and removed after that.
        </div>
      )}

      {/* Email (needed to match the code). Prefilled from signup/login. */}
      {!emailParam && (
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="your@email.com"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-orange-400"
        />
      )}

      <p className="text-sm font-medium text-gray-700 mb-2">Enter the 6-digit code</p>
      <CodeInput onComplete={submitCode} disabled={verifyingCode} />
      {verifyingCode && <p className="text-sm text-gray-500 mt-2">Verifying…</p>}
      {codeError && <p className="text-sm text-red-600 mt-2">{codeError}</p>}

      <div className="flex items-center gap-3 my-5">
        <div className="flex-1 h-px bg-gray-200" />
        <span className="text-xs text-gray-400">or</span>
        <div className="flex-1 h-px bg-gray-200" />
      </div>

      {resendState === 'done' ? (
        <div className="p-3 bg-green-50 border border-green-200 rounded-md text-sm text-green-800">
          If that account still needs verification, a new link and code are on their way.
        </div>
      ) : (
        <button
          onClick={handleResend}
          disabled={!email || resendState === 'sending'}
          className="w-full bg-white border border-orange-300 text-orange-700 hover:bg-orange-50 font-semibold py-2.5 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {resendState === 'sending' ? 'Sending…' : 'Resend email'}
        </button>
      )}

      <Link href="/login" className="block mt-4 text-orange-600 hover:text-orange-700 font-semibold">
        Back to Login
      </Link>
    </div>
  )
}

/** Six single-digit boxes that auto-advance and support paste/backspace. */
function CodeInput({ onComplete, disabled }: { onComplete: (code: string) => void; disabled?: boolean }) {
  const [digits, setDigits] = useState<string[]>(['', '', '', '', '', ''])
  const refs = useRef<Array<HTMLInputElement | null>>([])

  function setAt(i: number, val: string) {
    const next = [...digits]
    next[i] = val
    setDigits(next)
    return next
  }

  function handleChange(i: number, raw: string) {
    const val = raw.replace(/\D/g, '')
    if (!val) {
      setAt(i, '')
      return
    }
    // Take the last typed digit (handles fast typing / overwrite).
    const next = setAt(i, val[val.length - 1])
    if (i < 5) refs.current[i + 1]?.focus()
    if (next.every((d) => d !== '')) onComplete(next.join(''))
  }

  function handleKeyDown(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace') {
      if (digits[i]) {
        setAt(i, '')
      } else if (i > 0) {
        refs.current[i - 1]?.focus()
        setAt(i - 1, '')
      }
    } else if (e.key === 'ArrowLeft' && i > 0) {
      refs.current[i - 1]?.focus()
    } else if (e.key === 'ArrowRight' && i < 5) {
      refs.current[i + 1]?.focus()
    }
  }

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (!text) return
    e.preventDefault()
    const next = ['', '', '', '', '', '']
    for (let i = 0; i < text.length; i++) next[i] = text[i]
    setDigits(next)
    const focusIdx = Math.min(text.length, 5)
    refs.current[focusIdx]?.focus()
    if (text.length === 6) onComplete(text)
  }

  return (
    <div className="flex justify-center gap-2" onPaste={handlePaste}>
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el
          }}
          type="text"
          inputMode="numeric"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          maxLength={1}
          value={d}
          disabled={disabled}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onFocus={(e) => e.target.select()}
          className="w-11 h-14 text-center text-2xl font-semibold border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-orange-400 disabled:bg-gray-100"
        />
      ))}
    </div>
  )
}

function SuccessIcon() {
  return (
    <div className="inline-flex items-center justify-center w-16 h-16 bg-green-500 rounded-full mb-4">
      <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      </svg>
    </div>
  )
}
function MailIcon() {
  return (
    <div className="inline-flex items-center justify-center w-16 h-16 bg-orange-100 rounded-full mb-4">
      <svg className="w-8 h-8 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    </div>
  )
}
function ErrorIcon() {
  return (
    <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mb-4">
      <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
      </svg>
    </div>
  )
}

export default function VerifyEmailPage() {
  return (
    <div className="w-full min-h-screen flex flex-col md:flex-row">
      <div className="flex-1 bg-gradient-to-br from-slate-900 via-blue-900 to-orange-600 flex items-center justify-center p-8 md:p-12">
        <div className="text-white max-w-lg text-center md:text-left">
          <h1 className="text-4xl md:text-6xl font-bold mb-6 md:mb-8 leading-tight">One quick step</h1>
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
