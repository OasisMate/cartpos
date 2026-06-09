import React from 'react'

type Variant = 'neutral' | 'primary' | 'danger' | 'success' | 'warning'

// Ghost icon button for table row actions: compact, subtle by default, with
// the variant color revealed on hover/focus. `label` drives both the tooltip
// and the accessible name (icon-only buttons must have an aria-label).
const variantHover: Record<Variant, string> = {
  neutral: 'hover:bg-gray-100 hover:text-gray-900 focus-visible:text-gray-900',
  primary: 'hover:bg-blue-50 hover:text-blue-600 focus-visible:text-blue-600',
  danger: 'hover:bg-red-50 hover:text-red-600 focus-visible:text-red-600',
  success: 'hover:bg-green-50 hover:text-green-600 focus-visible:text-green-600',
  warning: 'hover:bg-amber-50 hover:text-amber-600 focus-visible:text-amber-600',
}

export default function IconButton({
  label,
  variant = 'neutral',
  className = '',
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string
  variant?: Variant
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-500 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-gray-300 disabled:pointer-events-none disabled:opacity-40 ${variantHover[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}
