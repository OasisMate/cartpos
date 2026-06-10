'use client'

import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'

type Audience = 'ALL_USERS' | 'ALL_ORG_ADMINS' | 'ORGS' | 'USERS'

interface OrgLite {
  id: string
  name: string
  status: string
}
interface UserLite {
  id: string
  name: string
  email: string
  role: string
}

const AUDIENCE_LABELS: Record<Audience, string> = {
  ALL_USERS: 'All users',
  ALL_ORG_ADMINS: 'All org owners / admins',
  ORGS: 'Specific organization(s)',
  USERS: 'Specific user(s)',
}

export default function BroadcastPage() {
  const { user } = useAuth()
  const [audience, setAudience] = useState<Audience>('ALL_ORG_ADMINS')
  const [orgs, setOrgs] = useState<OrgLite[]>([])
  const [users, setUsers] = useState<UserLite[]>([])
  const [selectedOrgs, setSelectedOrgs] = useState<Set<string>>(new Set())
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set())
  const [userSearch, setUserSearch] = useState('')
  const [inApp, setInApp] = useState(true)
  const [email, setEmail] = useState(false)
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [href, setHref] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<{ recipients: number; inApp: number; email: number } | null>(null)

  useEffect(() => {
    if (user?.role !== 'PLATFORM_ADMIN') return
    ;(async () => {
      try {
        const [o, u] = await Promise.all([
          fetch('/api/admin/organizations').then((r) => r.json()),
          fetch('/api/admin/users').then((r) => r.json()),
        ])
        setOrgs(o.organizations || [])
        setUsers((u.users || []).filter((x: UserLite) => x.role !== 'PLATFORM_ADMIN'))
      } catch {
        setError('Failed to load organizations / users')
      }
    })()
  }, [user])

  const filteredUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase()
    if (!q) return users
    return users.filter((u) => u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q))
  }, [users, userSearch])

  function toggle(set: Set<string>, id: string, setter: (s: Set<string>) => void) {
    const next = new Set(set)
    next.has(id) ? next.delete(id) : next.add(id)
    setter(next)
  }

  async function send() {
    setError('')
    setResult(null)
    if (!subject.trim() || !message.trim()) {
      setError('Subject and message are required.')
      return
    }
    if (!inApp && !email) {
      setError('Pick at least one channel (in-app or email).')
      return
    }
    if (audience === 'ORGS' && selectedOrgs.size === 0) {
      setError('Select at least one organization.')
      return
    }
    if (audience === 'USERS' && selectedUsers.size === 0) {
      setError('Select at least one user.')
      return
    }
    const confirmMsg =
      audience === 'ALL_USERS'
        ? 'Send this message to ALL users in the system?'
        : `Send this ${[inApp && 'in-app', email && 'email'].filter(Boolean).join(' + ')} message?`
    if (!window.confirm(confirmMsg)) return

    setSending(true)
    try {
      const res = await fetch('/api/admin/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audience,
          orgIds: [...selectedOrgs],
          userIds: [...selectedUsers],
          channels: { inApp, email },
          subject,
          message,
          href: href || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to send')
      setResult({ recipients: data.recipients, inApp: data.inApp, email: data.email })
      setSubject('')
      setMessage('')
      setHref('')
    } catch (e: any) {
      setError(e.message || 'Failed to send')
    } finally {
      setSending(false)
    }
  }

  if (user?.role !== 'PLATFORM_ADMIN') {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-2">Broadcast</h1>
        <p className="text-gray-600">Access denied.</p>
      </div>
    )
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-3xl font-bold mb-2 bg-gradient-to-r from-blue-600 to-orange-600 bg-clip-text text-transparent">
        Broadcast a message
      </h1>
      <p className="text-gray-600 mb-6">Send an in-app notification and/or email to your users.</p>

      {error && <div className="mb-4 p-3 bg-red-100 text-red-700 rounded">{error}</div>}
      {result && (
        <div className="mb-4 p-3 bg-green-100 text-green-800 rounded">
          Sent to {result.recipients} recipient(s){result.inApp ? ` · ${result.inApp} in-app` : ''}
          {result.email ? ` · ${result.email} email(s)` : ''}.
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-5">
        {/* Audience */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Audience</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {(Object.keys(AUDIENCE_LABELS) as Audience[]).map((a) => (
              <label
                key={a}
                className={`flex items-center gap-2 border rounded-md px-3 py-2 cursor-pointer text-sm ${
                  audience === a ? 'border-orange-400 bg-orange-50' : 'border-gray-300'
                }`}
              >
                <input type="radio" name="audience" checked={audience === a} onChange={() => setAudience(a)} />
                {AUDIENCE_LABELS[a]}
              </label>
            ))}
          </div>
        </div>

        {/* Org picker */}
        {audience === 'ORGS' && (
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Organizations ({selectedOrgs.size} selected)
            </label>
            <div className="max-h-44 overflow-y-auto border border-gray-200 rounded-md p-2 space-y-1">
              {orgs.map((o) => (
                <label key={o.id} className="flex items-center gap-2 text-sm px-1 py-0.5">
                  <input
                    type="checkbox"
                    checked={selectedOrgs.has(o.id)}
                    onChange={() => toggle(selectedOrgs, o.id, setSelectedOrgs)}
                  />
                  {o.name} <span className="text-xs text-gray-400">({o.status})</span>
                </label>
              ))}
              {orgs.length === 0 && <p className="text-sm text-gray-400 px-1">No organizations.</p>}
            </div>
          </div>
        )}

        {/* User picker */}
        {audience === 'USERS' && (
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Users ({selectedUsers.size} selected)
            </label>
            <input
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              placeholder="Search name or email…"
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
            <div className="max-h-44 overflow-y-auto border border-gray-200 rounded-md p-2 space-y-1">
              {filteredUsers.map((u) => (
                <label key={u.id} className="flex items-center gap-2 text-sm px-1 py-0.5">
                  <input
                    type="checkbox"
                    checked={selectedUsers.has(u.id)}
                    onChange={() => toggle(selectedUsers, u.id, setSelectedUsers)}
                  />
                  {u.name} <span className="text-xs text-gray-400">{u.email}</span>
                </label>
              ))}
              {filteredUsers.length === 0 && <p className="text-sm text-gray-400 px-1">No matching users.</p>}
            </div>
          </div>
        )}

        {/* Channels */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Channels</label>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={inApp} onChange={(e) => setInApp(e.target.checked)} /> In-app notification
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={email} onChange={(e) => setEmail(e.target.checked)} /> Email
            </label>
          </div>
        </div>

        {/* Content */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">Subject / Title</label>
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="e.g. Scheduled maintenance this Sunday"
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">Message</label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={5}
            placeholder="Write your message…"
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
          />
        </div>
        {inApp && (
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">In-app link (optional)</label>
            <input
              value={href}
              onChange={(e) => setHref(e.target.value)}
              placeholder="/store or /org  (where the bell click takes them)"
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
          </div>
        )}

        <div className="flex justify-end">
          <button
            onClick={send}
            disabled={sending}
            className="px-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-md transition-colors disabled:opacity-50"
          >
            {sending ? 'Sending…' : 'Send broadcast'}
          </button>
        </div>
      </div>
    </div>
  )
}
