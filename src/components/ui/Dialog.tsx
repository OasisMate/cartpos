'use client'

import * as React from 'react'

export function Dialog({
  open,
  onOpenChange,
  children,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  children: React.ReactNode
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={() => onOpenChange(false)} />
      <div className="relative card card-body w-full max-w-lg">
        {children}
      </div>
    </div>
  )
}

export function DialogHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mb-4">
      <div className="text-lg font-semibold">{title}</div>
      {description && <div className="text-sm text-[hsl(var(--muted-foreground))]">{description}</div>}
    </div>
  )
}

export function DialogFooter({ children }: { children: React.ReactNode }) {
  return <div className="mt-4 flex justify-end gap-2">{children}</div>
}


