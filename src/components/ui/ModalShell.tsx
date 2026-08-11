'use client'

import { useEffect } from 'react'
import { createPortal } from 'react-dom'

/**
 * Full-screen modal overlay, rendered into document.body.
 *
 * The portal is the point. A `fixed inset-0` overlay declared inline inside a
 * page still participates in that page's layout, so a parent using Tailwind's
 * `space-y-*` (which sets `margin-top` on `> * + *`) pushed the overlay down by
 * the gap size and left an undimmed strip across the top of the screen. Margin
 * applies to fixed elements too. Escaping to document.body means a modal can
 * never be nudged by the layout it happens to be declared in.
 *
 * Also handles the things every one of these modals wants anyway: Escape to
 * close, a locked background scroll, and click-outside to dismiss.
 */
export function ModalShell({
  onClose,
  children,
  /** Set false for a step the user must resolve rather than dismiss. */
  dismissable = true,
  className = 'w-full max-w-md',
  /**
   * Skip the white card entirely, for content that is its own surface such as a
   * receipt image. Structural rather than a `bg-transparent` override, because
   * Tailwind resolves conflicting utilities by stylesheet order, not by the
   * order they appear in the class attribute, so overriding the base `bg-white`
   * that way silently fails.
   */
  bare = false,
}: {
  onClose: () => void
  children: React.ReactNode
  dismissable?: boolean
  className?: string
  bare?: boolean
}) {
  useEffect(() => {
    if (!dismissable) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [dismissable, onClose])

  // Stop the page behind from scrolling while a modal is open.
  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [])

  // Server render has no document; the portal only exists on the client.
  if (typeof document === 'undefined') return null

  return createPortal(
    <div
      // m-0 defends against a stray margin even here, since this now sits on
      // body rather than inside any spacing container.
      className="fixed inset-0 z-[60] m-0 flex items-center justify-center overflow-y-auto bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      onClick={dismissable ? onClose : undefined}
    >
      <div
        className={
          bare
            ? `max-h-[90vh] overflow-y-auto ${className}`
            : `max-h-[90vh] overflow-y-auto rounded-xl bg-white p-6 shadow-xl ${className}`
        }
        // Clicks inside must not reach the backdrop's dismiss handler.
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    document.body
  )
}
