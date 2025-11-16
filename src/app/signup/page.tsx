'use client'

import { useState } from 'react'
import Link from 'next/link'

export default function SignupPage() {
  const [form, setForm] = useState({
    organizationName: '',
    contactName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    city: '',
    notes: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!form.organizationName || !form.contactName || !form.email || !form.password) {
      setError('Please fill all required fields')
      return
    }
    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Signup failed')
        setSubmitting(false)
        return
      }
      setSuccess(true)
    } catch (e) {
      setError('Unexpected error')
    } finally {
      setSubmitting(false)
    }
  }

  if (success) {
    return (
      <div className="max-w-md mx-auto mt-24 card">
        <div className="card-body">
          <h1 className="text-2xl font-bold mb-2">Signup submitted</h1>
          <p className="text-[hsl(var(--muted-foreground))] mb-6">
            Your organization request is pending approval. You will be able to log in after a
            platform admin approves it.
          </p>
          <Link className="btn btn-primary h-9 px-4" href="/login">
            Go to Login
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-md mx-auto mt-16 card">
      <div className="card-body">
        <h1 className="text-2xl font-bold mb-2">Create Organization</h1>
        <p className="text-[hsl(var(--muted-foreground))] mb-6">
          Sign up your company to get started.
        </p>
        {error && <div className="mb-4 p-3 bg-red-100 text-red-700 rounded">{error}</div>}
        <form onSubmit={onSubmit} className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">Organization Name *</label>
            <input
              className="input"
              value={form.organizationName}
              onChange={(e) => setForm({ ...form, organizationName: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Your Name *</label>
            <input
              className="input"
              value={form.contactName}
              onChange={(e) => setForm({ ...form, contactName: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Email *</label>
            <input
              type="email"
              className="input"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Phone</label>
            <input
              className="input"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Password *</label>
              <input
                type="password"
                className="input"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Confirm Password *</label>
              <input
                type="password"
                className="input"
                value={form.confirmPassword}
                onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">City</label>
              <input
                className="input"
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Notes</label>
              <input
                className="input"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
          </div>
          <div className="flex items-center justify-between pt-2">
            <Link className="text-sm text-[hsl(var(--muted-foreground))] hover:underline" href="/login">
              Already have an account? Login
            </Link>
            <button
              type="submit"
              className="btn btn-primary h-9 px-4"
              disabled={submitting}
            >
              {submitting ? 'Submitting...' : 'Create Organization'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}


