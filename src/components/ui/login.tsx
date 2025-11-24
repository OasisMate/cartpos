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

interface LoginFormData {
  identifier: string
  password: string
}

export default function Login() {
  const router = useRouter()
  const { refreshUser } = useAuth()
  const [isRedirecting, setIsRedirecting] = useState(false)

  const { values, error, loading, handleChange, handleSubmit, setError } = useForm<LoginFormData>({
    initialValues: {
      identifier: '',
      password: '',
    },
    onSubmit: async (formData) => {
      try {
        await apiPost('/api/auth/login', {
          identifier: formData.identifier,
          password: formData.password,
        })

        await refreshUser()
        
        // Set redirecting state to keep loader active
        setIsRedirecting(true)
        
        // Navigate and wait for it to complete
        router.push('/')
        router.refresh()
        
        // Keep loading state active - it will be cleared when component unmounts on redirect
      } catch (err: any) {
        setIsRedirecting(false)
        setError(err.message || 'Login failed. Please check your credentials.')
        throw err
      }
    },
  })

  // Combined loading state - true if form is loading OR redirecting
  const isLoading = loading || isRedirecting

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
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="ml-2 text-sm text-gray-600">Remember me</span>
            </label>
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
