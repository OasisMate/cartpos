'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { AuthHero } from '@/components/auth/AuthHero'
import { AuthFormContainer } from '@/components/auth/AuthFormContainer'
import { FormInput } from '@/components/ui/FormInput'
import { PasswordInput } from '@/components/ui/PasswordInput'
import { ErrorAlert } from '@/components/ui/ErrorAlert'
import { SubmitButton } from '@/components/ui/SubmitButton'
import { CodeInput } from '@/components/ui/CodeInput'
import { AUTH_HERO } from '@/constants/auth'
import { validatePassword } from '@/lib/validation/password'
import { PasswordStrength } from '@/components/ui/PasswordStrength'

export default function ForgotPasswordPage() {
  const router = useRouter()
  const [step, setStep] = useState<'email' | 'reset' | 'done'>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function sendCode(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setLoading(true)
    setError('')
    try {
      await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      // Always advance (the API never reveals whether the email exists).
      setStep('reset')
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  async function submitReset(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!/^\d{6}$/.test(code)) {
      setError('Enter the 6-digit code from your email.')
      return
    }
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
        body: JSON.stringify({ email, code, password }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to reset password')
      setStep('done')
      setTimeout(() => router.push('/login'), 2500)
    } catch (err: any) {
      setError(err.message || 'Failed to reset password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full min-h-screen flex flex-col md:flex-row" dir="ltr">
      <AuthHero {...AUTH_HERO.login} />
      <AuthFormContainer
        title={step === 'done' ? 'Password updated' : 'Reset your password'}
        subtitle={
          step === 'email'
            ? "Enter your email and we'll send a reset code"
            : step === 'reset'
            ? 'Enter the code and choose a new password'
            : 'You can now sign in with your new password'
        }
      >
        <ErrorAlert message={error} />

        {step === 'email' && (
          <form onSubmit={sendCode} className="space-y-6">
            <FormInput
              label="Email"
              name="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your account email"
              required
              disabled={loading}
              autoComplete="email"
            />
            <SubmitButton loading={loading} loadingText="Sending...">
              Send reset code
            </SubmitButton>
            <div className="text-center">
              <Link href="/login" className="text-blue-600 hover:text-blue-700 font-semibold">
                Back to login
              </Link>
            </div>
          </form>
        )}

        {step === 'reset' && (
          <form onSubmit={submitReset} className="space-y-5">
            <div className="p-3 bg-orange-50 border border-orange-100 rounded-md text-sm text-orange-800">
              We sent a 6-digit code and a reset link to <strong>{email}</strong>. Enter the code below, or
              click the link in the email.
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 text-center">Verification code</label>
              <CodeInput onComplete={setCode} disabled={loading} />
            </div>
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
              <button
                type="button"
                onClick={() => setStep('email')}
                className="text-blue-600 hover:text-blue-700 font-semibold"
              >
                Use a different email
              </button>
            </div>
          </form>
        )}

        {step === 'done' && (
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
        )}
      </AuthFormContainer>
    </div>
  )
}
