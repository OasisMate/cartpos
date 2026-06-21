import type React from 'react'

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'

/**
 * Keep Tab / Shift+Tab focus cycling inside `container`. Call from a modal's
 * onKeyDown. No-op for non-Tab keys so other handlers run normally.
 */
export function trapTab(
  e: React.KeyboardEvent | KeyboardEvent,
  container: HTMLElement | null,
) {
  if (e.key !== 'Tab' || !container) return
  const items = Array.from(
    container.querySelectorAll<HTMLElement>(FOCUSABLE),
  ).filter((el) => el.offsetParent !== null)
  if (items.length === 0) return
  const first = items[0]
  const last = items[items.length - 1]
  const active = document.activeElement
  if (e.shiftKey) {
    if (active === first || !container.contains(active)) {
      e.preventDefault()
      last.focus()
    }
  } else if (active === last || !container.contains(active)) {
    e.preventDefault()
    first.focus()
  }
}
