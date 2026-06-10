'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import Link from 'next/link'
import { AuthHero } from '@/components/auth/AuthHero'
import { AuthFormContainer } from '@/components/auth/AuthFormContainer'
import { FormInput } from '@/components/ui/FormInput'
import { PasswordInput } from '@/components/ui/PasswordInput'
import { ErrorAlert } from '@/components/ui/ErrorAlert'
import { SubmitButton } from '@/components/ui/SubmitButton'
import { useForm } from '@/hooks/useForm'
import { apiPost } from '@/lib/api'
import { AUTH_HERO, AUTH_FORM } from '@/constants/auth'
import { CodeInput } from '@/components/ui/CodeInput'

interface LoginFormData {
  identifier: string
  password: string
}

interface LoginResponse {
  twoFactor?: boolean
  preAuthToken?: string
  email?: string
  user?: { id: string; name: string; email: string; role: string }
}

export default function Login() {
  const router = useRouter()
  const { refreshUser } = useAuth()
  const [isRedirecting, setIsRedirecting] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  // 2FA second step
  const [twoFA, setTwoFA] = useState<{ preAuthToken: string; email: string } | null>(null)
  const [codeError, setCodeError] = useState('')
  const [verifying, setVerifying] = useState(false)

  async function finishLogin() {
    await refreshUser()
    setIsRedirecting(true)
    router.push('/')
    router.refresh()
  }

  const { values, error, loading, handleChange, handleSubmit, setError } = useForm<LoginFormData>({
    initialValues: {
      identifier: '',
      password: '',
    },
    onSubmit: async (formData) => {
      try {
        const res = await apiPost<LoginResponse>('/api/auth/login', {
          identifier: formData.identifier,
          password: formData.password,
          rememberMe,
        })

        // 2FA enabled: switch to the code step instead of completing login.
        if (res?.twoFactor && res.preAuthToken) {
          setTwoFA({ preAuthToken: res.preAuthToken, email: res.email || '' })
          return
        }

        await finishLogin()
      } catch (err: any) {
        setIsRedirecting(false)
        // Unverified email: send them to the verify screen (which offers resend).
        if (err?.code === 'EMAIL_NOT_VERIFIED') {
          const email = err?.payload?.email || formData.identifier
          router.push(`/verify-email?email=${encodeURIComponent(email)}`)
          return
        }
        setError(err.message || 'Login failed. Please check your credentials.')
        throw err
      }
    },
  })

  async function submitCode(code: string) {
    if (!twoFA) return
    setVerifying(true)
    setCodeError('')
    try {
      await apiPost('/api/auth/login/verify-2fa', {
        preAuthToken: twoFA.preAuthToken,
        code,
        rememberMe,
      })
      await finishLogin()
    } catch (err: any) {
      setVerifying(false)
      setCodeError(err.message || 'Invalid code. Please try again.')
    }
  }

  // Combined loading state - true if form is loading OR redirecting
  const isLoading = loading || isRedirecting

  // 2FA code step
  if (twoFA) {
    return (
      <div className="w-full min-h-screen flex flex-col md:flex-row" dir="ltr">
        <AuthHero {...AUTH_HERO.login} />
        <AuthFormContainer title="Two-step verification" subtitle="Enter the code we emailed you">
          <div className="text-center">
            <p className="text-sm text-gray-600 mb-1">
              We sent a 6-digit code to {twoFA.email ? <strong>{twoFA.email}</strong> : 'your email'}.
            </p>
            <p className="text-xs text-gray-400 mb-5">It expires in 10 minutes.</p>
            <CodeInput onComplete={submitCode} disabled={verifying || isRedirecting} />
            {verifying && <p className="text-sm text-gray-500 mt-3">Verifying…</p>}
            {codeError && <p className="text-sm text-red-600 mt-3">{codeError}</p>}
            <button
              onClick={() => {
                setTwoFA(null)
                setCodeError('')
              }}
              className="block mx-auto mt-5 text-blue-600 hover:text-blue-700 font-semibold text-sm"
            >
              Back to login
            </button>
          </div>
        </AuthFormContainer>
      </div>
    )
  }

  return (
    <div className="w-full min-h-screen flex flex-col md:flex-row" dir="ltr">
      <AuthHero {...AUTH_HERO.login} />

      <AuthFormContainer {...AUTH_FORM.login}>
        <ErrorAlert message={error} />

        <form onSubmit={handleSubmit} className="space-y-6">
          <FormInput
            label="Email, Phone, or CNIC"
            name="identifier"
            value={values.identifier}
            onChange={handleChange('identifier')}
            placeholder="Enter your email, phone, or CNIC"
            required
            disabled={isLoading}
            autoComplete="username"
          />

          <PasswordInput
            label="Password"
            name="password"
            value={values.password}
            onChange={handleChange('password')}
            placeholder="Enter your password"
            required
            disabled={isLoading}
            autoComplete="current-password"
          />

          <div className="flex items-center justify-between">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                disabled={isLoading}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="ml-2 text-sm text-gray-600">Remember me</span>
            </label>
            <Link href="/forgot-password" className="text-sm text-blue-600 hover:text-blue-700 font-semibold">
              Forgot password?
            </Link>
          </div>

          <SubmitButton loading={isLoading} loadingText={isRedirecting ? "Redirecting..." : "Signing in..."}>
            Sign In
          </SubmitButton>

          <div className="text-center">
            <span className="text-gray-600">Don&apos;t have an account?</span>{' '}
            <Link href="/signup" className="text-blue-600 hover:text-blue-700 font-semibold">
              Sign Up
            </Link>
          </div>
        </form>
      </AuthFormContainer>
    </div>
  )
}
