'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Bell, Check } from 'lucide-react'
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

export default function NotificationBell({ sidebarOpen }: { sidebarOpen: boolean }) {
  const router = useRouter()
  const [items, setItems] = useState<NotificationItem[]>([])
  const [unread, setUnread] = useState(0)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement | null>(null)

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

  async function markAllRead() {
    setUnread(0)
    setItems((prev) => prev.map((n) => ({ ...n, read: true })))
    try {
      await fetch('/api/notifications/read', { method: 'POST' })
    } catch {
      /* ignore */
    }
  }

  function onItemClick(n: NotificationItem) {
    setOpen(false)
    if (!n.read) {
      setUnread((u) => Math.max(0, u - 1))
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)))
      fetch('/api/notifications/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [n.id] }),
      }).catch(() => {})
    }
    if (n.href) router.push(n.href)
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title="Notifications"
        aria-label="Notifications"
        className={cn(
          'w-full flex items-center py-1.5 rounded-md transition-colors text-sm hover:bg-blue-100 text-gray-700',
          sidebarOpen ? 'gap-2 px-3 justify-between' : 'justify-center px-0'
        )}
      >
        <div className="flex items-center gap-3">
          <div className="relative">
            <Bell className="h-5 w-5 flex-shrink-0 text-gray-700" />
            {unread > 0 && (
              <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-semibold flex items-center justify-center">
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </div>
          {sidebarOpen && <span className="font-medium">Notifications</span>}
        </div>
        {sidebarOpen && unread > 0 && (
          <span className="text-xs text-red-600 font-semibold">{unread} new</span>
        )}
      </button>

      {open && (
        <div className="absolute bottom-full mb-2 left-0 w-72 max-h-96 overflow-y-auto rounded-lg border border-blue-100 bg-white shadow-lg z-50">
          <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 sticky top-0 bg-white">
            <span className="text-sm font-semibold text-gray-900">Notifications</span>
            {unread > 0 && (
              <button
                type="button"
                onClick={markAllRead}
                className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
              >
                <Check className="h-3 w-3" /> Mark all read
              </button>
            )}
          </div>
          {items.length === 0 ? (
            <div className="px-3 py-6 text-center text-sm text-gray-500">No notifications yet.</div>
          ) : (
            <ul className="divide-y divide-gray-50">
              {items.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => onItemClick(n)}
                    className={cn(
                      'w-full text-left px-3 py-2.5 hover:bg-blue-50 transition-colors flex gap-2',
                      !n.read && 'bg-blue-50/40'
                    )}
                  >
                    <span
                      className={cn(
                        'mt-1.5 h-2 w-2 rounded-full flex-shrink-0',
                        n.read ? 'bg-transparent' : 'bg-blue-500'
                      )}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-gray-900 truncate">{n.title}</span>
                      {n.body && (
                        <span className="block text-xs text-gray-600 line-clamp-2">{n.body}</span>
                      )}
                      <span className="block text-[11px] text-gray-400 mt-0.5">{timeAgo(n.createdAt)}</span>
                    </span>
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
