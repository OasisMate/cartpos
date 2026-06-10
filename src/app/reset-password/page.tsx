'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { AuthHero } from '@/components/auth/AuthHero'
import { AuthFormContainer } from '@/components/auth/AuthFormContainer'
import { PasswordInput } from '@/components/ui/PasswordInput'
import { ErrorAlert } from '@/components/ui/ErrorAlert'
import { SubmitButton } from '@/components/ui/SubmitButton'
import { AUTH_HERO } from '@/constants/auth'
import { validatePassword } from '@/lib/validation/password'
import { PasswordStrength } from '@/components/ui/PasswordStrength'

function ResetInner() {
  const router = useRouter()
  const token = useSearchParams().get('token') || ''
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    const pw = validatePassword(password)
    if (!pw.ok) {
      setError(`Password must: ${pw.errors.join('; ')}.`)
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to reset password')
      setDone(true)
      setTimeout(() => router.push('/login'), 2500)
    } catch (err: any) {
      setError(err.message || 'Failed to reset password')
    } finally {
      setLoading(false)
    }
  }

  if (!token) {
    return (
      <div className="text-center">
        <p className="text-gray-600 mb-4">This reset link is missing its token or is invalid.</p>
        <Link href="/forgot-password" className="text-blue-600 hover:text-blue-700 font-semibold">
          Request a new reset link
        </Link>
      </div>
    )
  }

  if (done) {
    return (
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-green-500 rounded-full mb-4">
          <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <p className="text-gray-600 mb-4">Your password has been updated. Redirecting to login…</p>
        <Link href="/login" className="text-blue-600 hover:text-blue-700 font-semibold">
          Go to login
        </Link>
      </div>
    )
  }

  return (
    <>
      <ErrorAlert message={error} />
      <form onSubmit={submit} className="space-y-6">
        <PasswordInput
          label="New password"
          name="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Choose a new password"
          required
          disabled={loading}
          autoComplete="new-password"
        />
        <PasswordStrength value={password} />
        <PasswordInput
          label="Confirm new password"
          name="confirm"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="Re-enter the password"
          required
          disabled={loading}
          autoComplete="new-password"
        />
        <SubmitButton loading={loading} loadingText="Updating...">
          Update password
        </SubmitButton>
        <div className="text-center">
          <Link href="/login" className="text-blue-600 hover:text-blue-700 font-semibold">
            Back to login
          </Link>
        </div>
      </form>
    </>
  )
}

export default function ResetPasswordPage() {
  return (
    <div className="w-full min-h-screen flex flex-col md:flex-row" dir="ltr">
      <AuthHero {...AUTH_HERO.login} />
      <AuthFormContainer title="Set a new password" subtitle="Choose a strong password for your account">
        <Suspense fallback={<div className="text-gray-500 text-center">Loading…</div>}>
          <ResetInner />
        </Suspense>
      </AuthFormContainer>
    </div>
  )
}
