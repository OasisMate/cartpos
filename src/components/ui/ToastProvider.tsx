'use client'

import React, { createContext, useCallback, useContext, useMemo, useState } from 'react'

type Toast = { id: string; title?: string; message: string; variant?: 'default' | 'success' | 'warning' | 'destructive' }

type ToastContextValue = {
  show: (t: Omit<Toast, 'id'>) => void
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined)

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const show = useCallback((t: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).slice(2)
    setToasts((prev) => [...prev, { id, ...t }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((x) => x.id !== id))
    }, 3000)
  }, [])

  const value = useMemo(() => ({ show }), [show])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed bottom-4 right-4 flex flex-col gap-2 z-[100]">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`card px-4 py-3 shadow ${
              t.variant === 'destructive'
                ? 'border-red-200'
                : t.variant === 'success'
                ? 'border-green-200'
                : t.variant === 'warning'
                ? 'border-yellow-200'
                : ''
            }`}
          >
            {t.title && <div className="text-sm font-semibold mb-0.5">{t.title}</div>}
            <div className="text-sm">{t.message}</div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}


