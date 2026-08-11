'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Loader2 } from 'lucide-react'

/**
 * Platform admin: plan prices and where shops send money.
 *
 * Both live in the database rather than code so a price or a bank account can
 * be corrected from the UI without a deploy.
 */

interface Plan {
  id: string
  code: string
  name: string
  tagline: string | null
  monthlyPrice: number
  maxShops: number | null
  maxUsers: number | null
  maxCashiers: number | null
  extraShopPrice: number | null
  isPopular: boolean
  isActive: boolean
  _count?: { subscriptions: number }
}

const INPUT = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm'

export default function BillingSettingsPage() {
  const [plans, setPlans] = useState<Plan[]>([])
  const [settings, setSettings] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    try {
      const [p, s] = await Promise.all([
        fetch('/api/admin/plans').then((r) => r.json()),
        fetch('/api/admin/billing-settings').then((r) => r.json()),
      ])
      setPlans(p.plans || [])
      setSettings(s.settings || {})
    } catch (e: any) {
      setError(e.message || 'Failed to load')
    } finally {
      setLoading(false)
    }
  }

  async function savePlan(plan: Plan) {
    setSaving(plan.code)
    setError('')
    setMessage('')
    try {
      const res = await fetch('/api/admin/plans', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: plan.code,
          monthlyPrice: plan.monthlyPrice,
          extraShopPrice: plan.extraShopPrice,
          maxShops: plan.maxShops,
          maxUsers: plan.maxUsers,
          maxCashiers: plan.maxCashiers,
          tagline: plan.tagline,
          isPopular: plan.isPopular,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed')
      setMessage(json.note || 'Saved.')
      await load()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving('')
    }
  }

  async function saveSettings() {
    setSaving('settings')
    setError('')
    setMessage('')
    try {
      const res = await fetch('/api/admin/billing-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed')
      setMessage('Payment details saved. Shops will see these on their billing page.')
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving('')
    }
  }

  function setPlanField(code: string, field: keyof Plan, value: any) {
    setPlans((prev) => prev.map((p) => (p.code === code ? { ...p, [field]: value } : p)))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-500">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading...
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <Link href="/admin/subscriptions" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800">
          <ArrowLeft className="h-4 w-4" /> Subscriptions
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">Billing setup</h1>
        <p className="text-sm text-gray-600">Plan prices and where shops send their payments.</p>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}
      {message && <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">{message}</div>}

      <section>
        <h2 className="mb-1 text-lg font-semibold text-gray-900">Plans</h2>
        <p className="mb-3 text-sm text-gray-600">
          Changing a price here affects new signups only. Existing customers keep the price they agreed, so a rise
          never repriced anyone behind their back.
        </p>
        <div className="space-y-3">
          {plans.map((p) => (
            <div key={p.code} className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900">{p.name}</h3>
                  <p className="text-xs text-gray-500">
                    {p._count?.subscriptions ?? 0} subscription{(p._count?.subscriptions ?? 0) === 1 ? '' : 's'}
                  </p>
                </div>
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={p.isPopular}
                    onChange={(e) => setPlanField(p.code, 'isPopular', e.target.checked)}
                    className="h-4 w-4"
                  />
                  Most popular
                </label>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                <Field label="Rs / month">
                  <input
                    type="number"
                    value={p.monthlyPrice}
                    onChange={(e) => setPlanField(p.code, 'monthlyPrice', Number(e.target.value))}
                    className={INPUT}
                  />
                </Field>
                <Field label="Max shops">
                  <input
                    type="number"
                    value={p.maxShops ?? ''}
                    placeholder="unlimited"
                    onChange={(e) => setPlanField(p.code, 'maxShops', e.target.value === '' ? null : Number(e.target.value))}
                    className={INPUT}
                  />
                </Field>
                <Field label="Max users">
                  <input
                    type="number"
                    value={p.maxUsers ?? ''}
                    placeholder="unlimited"
                    onChange={(e) => setPlanField(p.code, 'maxUsers', e.target.value === '' ? null : Number(e.target.value))}
                    className={INPUT}
                  />
                </Field>
                <Field label="Max cashiers">
                  <input
                    type="number"
                    value={p.maxCashiers ?? ''}
                    placeholder="unlimited"
                    onChange={(e) => setPlanField(p.code, 'maxCashiers', e.target.value === '' ? null : Number(e.target.value))}
                    className={INPUT}
                  />
                </Field>
                <Field label="Extra shop Rs">
                  <input
                    type="number"
                    value={p.extraShopPrice ?? ''}
                    placeholder="n/a"
                    onChange={(e) =>
                      setPlanField(p.code, 'extraShopPrice', e.target.value === '' ? null : Number(e.target.value))
                    }
                    className={INPUT}
                  />
                </Field>
              </div>
              <div className="mt-3">
                <Field label="Tagline">
                  <input
                    value={p.tagline ?? ''}
                    onChange={(e) => setPlanField(p.code, 'tagline', e.target.value)}
                    className={INPUT}
                  />
                </Field>
              </div>
              <button
                onClick={() => savePlan(p)}
                disabled={saving === p.code}
                className="mt-3 rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-50"
              >
                {saving === p.code ? 'Saving...' : `Save ${p.name}`}
              </button>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="mb-1 text-lg font-semibold text-gray-900">Where shops send money</h2>
        <p className="mb-4 text-sm text-gray-600">
          These appear on every shop&apos;s billing page. Leave a field blank to hide it.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            ['bankName', 'Bank name'],
            ['accountTitle', 'Account title'],
            ['accountNumber', 'Account number'],
            ['iban', 'IBAN'],
            ['jazzcashNumber', 'JazzCash number'],
            ['easypaisaNumber', 'Easypaisa number'],
            ['whatsappNumber', 'Your WhatsApp number'],
            ['supportEmail', 'Support email'],
          ].map(([key, label]) => (
            <Field key={key} label={label}>
              <input
                value={settings?.[key] ?? ''}
                onChange={(e) => setSettings({ ...settings, [key]: e.target.value })}
                className={INPUT}
              />
            </Field>
          ))}
        </div>
        <div className="mt-3">
          <Field label="Extra instructions (optional)">
            <textarea
              rows={3}
              value={settings?.instructions ?? ''}
              onChange={(e) => setSettings({ ...settings, instructions: e.target.value })}
              placeholder="e.g. Always write your shop name in the transfer reference."
              className={INPUT}
            />
          </Field>
        </div>
        <button
          onClick={saveSettings}
          disabled={saving === 'settings'}
          className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {saving === 'settings' ? 'Saving...' : 'Save payment details'}
        </button>
      </section>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">{label}</label>
      {children}
    </div>
  )
}
