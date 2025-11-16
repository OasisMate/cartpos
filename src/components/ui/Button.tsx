import React from 'react'

type Variant = 'primary' | 'outline'
type Size = 'sm' | 'md' | 'lg'

const sizeClasses: Record<Size, string> = {
  sm: 'h-8 px-3',
  md: 'h-9 px-4',
  lg: 'h-10 px-5',
}

export default function Button({
  children,
  className = '',
  variant = 'primary',
  size = 'md',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant
  size?: Size
}) {
  const base =
    variant === 'primary'
      ? 'btn-primary'
      : 'btn-outline'
  return (
    <button className={`${base} ${sizeClasses[size]} ${className}`} {...props}>
      {children}
    </button>
  )
}


