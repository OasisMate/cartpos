'use client'

import React from 'react'
import { X } from 'lucide-react'

type Size = 'sm' | 'md' | 'lg' | 'xl'

const sizeClasses: Record<Size, string> = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
}

/**
 * Shared modal wrapper. Provides a consistent overlay, panel, title bar and
 * close behaviour (backdrop click + X button) across the app.
 */
export default function Modal({
  open,
  onClose,
  title,
  size = 'md',
  children,
}: {
  open: boolean
  onClose: () => void
  title?: string
  size?: Size
  children: React.ReactNode
}) {
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className={`w-full ${sizeClasses[size]} max-h-[90vh] overflow-y-auto rounded-lg bg-white p-6 shadow-xl`}
      >
        {title && (
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-bold">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              className="text-gray-400 transition-colors hover:text-gray-600"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        )}
        {children}
      </div>
    </div>
  )
}
