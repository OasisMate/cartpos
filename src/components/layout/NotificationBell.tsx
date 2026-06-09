'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Bell, Check, Trash2, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface NotificationItem {
  id: string
  type: string
  title: string
  body: string | null
  href: string | null
  read: boolean
  createdAt: string
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  return `${d}d ago`
}

const JSON_HEADERS = { 'Content-Type': 'application/json' }

export default function NotificationBell({ sidebarOpen }: { sidebarOpen?: boolean }) {
  const router = useRouter()
  const [items, setItems] = useState<NotificationItem[]>([])
  const [unread, setUnread] = useState(0)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement | null>(null)

  // Close the panel when the sidebar collapses so it can't linger detached.
  useEffect(() => {
    if (sidebarOpen === false) setOpen(false)
  }, [sidebarOpen])

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications')
      if (!res.ok) return
      const data = await res.json()
      setItems(data.notifications || [])
      setUnread(data.unread || 0)
    } catch {
      /* ignore */
    }
  }, [])

  // Initial load + light polling (60s) so the badge stays fresh without being chatty.
  useEffect(() => {
    load()
    const id = setInterval(load, 60000)
    return () => clearInterval(id)
  }, [load])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const t = setTimeout(() => document.addEventListener('click', onClick, true), 10)
    return () => {
      clearTimeout(t)
      document.removeEventListener('click', onClick, true)
    }
  }, [open])

  function markAllRead() {
    if (unread === 0) return
    setUnread(0)
    setItems((prev) => prev.map((n) => ({ ...n, read: true })))
    fetch('/api/notifications/read', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ read: true }) }).catch(() => {})
  }

  function clearAll() {
    setItems([])
    setUnread(0)
    fetch('/api/notifications/clear', { method: 'POST' }).catch(() => {})
  }

  function toggleRead(e: React.MouseEvent, n: NotificationItem) {
    e.stopPropagation()
    const next = !n.read
    setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: next } : x)))
    setUnread((u) => (next ? Math.max(0, u - 1) : u + 1))
    fetch('/api/notifications/read', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ ids: [n.id], read: next }) }).catch(() => {})
  }

  function removeItem(e: React.MouseEvent, n: NotificationItem) {
    e.stopPropagation()
    setItems((prev) => prev.filter((x) => x.id !== n.id))
    if (!n.read) setUnread((u) => Math.max(0, u - 1))
    fetch('/api/notifications/clear', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ ids: [n.id] }) }).catch(() => {})
  }

  function onItemClick(n: NotificationItem) {
    if (!n.read) {
      setUnread((u) => Math.max(0, u - 1))
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)))
      fetch('/api/notifications/read', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ ids: [n.id], read: true }) }).catch(() => {})
    }
    if (n.href) {
      setOpen(false)
      router.push(n.href)
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title="Notifications"
        aria-label={unread > 0 ? `Notifications (${unread} unread)` : 'Notifications'}
        className="relative inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-600 transition-colors hover:bg-blue-100 hover:text-blue-700"
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-semibold flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute bottom-full mb-2 left-0 w-72 max-h-96 overflow-y-auto rounded-lg border border-blue-100 bg-white shadow-lg z-50">
          <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-gray-100 sticky top-0 bg-white">
            <span className="text-sm font-semibold text-gray-900">Notifications</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={markAllRead}
                disabled={unread === 0}
                title="Mark all read"
                className="text-xs text-blue-600 hover:text-blue-700 disabled:text-gray-300 flex items-center gap-1"
              >
                <Check className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={clearAll}
                disabled={items.length === 0}
                title="Clear all"
                className="text-xs text-red-600 hover:text-red-700 disabled:text-gray-300 flex items-center gap-1"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
          {items.length === 0 ? (
            <div className="px-3 py-6 text-center text-sm text-gray-500">No notifications.</div>
          ) : (
            <ul className="divide-y divide-gray-50">
              {items.map((n) => (
                <li
                  key={n.id}
                  className={cn('group flex items-start gap-2 px-3 py-2.5 hover:bg-blue-50/60 transition-colors', !n.read && 'bg-blue-50/40')}
                >
                  <button
                    type="button"
                    onClick={(e) => toggleRead(e, n)}
                    title={n.read ? 'Mark as unread' : 'Mark as read'}
                    aria-label={n.read ? 'Mark as unread' : 'Mark as read'}
                    className="mt-1 flex-shrink-0"
                  >
                    <span className={cn('block h-2.5 w-2.5 rounded-full border', n.read ? 'border-gray-300 bg-transparent' : 'border-blue-500 bg-blue-500')} />
                  </button>
                  <button type="button" onClick={() => onItemClick(n)} className="min-w-0 flex-1 text-left">
                    <span className="block text-sm font-medium text-gray-900 truncate">{n.title}</span>
                    {n.body && <span className="block text-xs text-gray-600 line-clamp-2">{n.body}</span>}
                    <span className="block text-[11px] text-gray-400 mt-0.5">{timeAgo(n.createdAt)}</span>
                  </button>
                  <button
                    type="button"
                    onClick={(e) => removeItem(e, n)}
                    title="Remove"
                    aria-label="Remove notification"
                    className="mt-0.5 flex-shrink-0 text-gray-300 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
