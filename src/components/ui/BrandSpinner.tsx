'use client'

import { useId } from 'react'
import { cn } from '@/lib/utils'

/**
 * Branded loading indicator: the full CartPOS mark (cart + CP, same as the
 * sidebar/login Logo) gently pulsing. Matches the logo so loaders feel part of
 * the product. The mark stays upright (a spinning wordmark reads badly).
 */
export function BrandSpinner({ size = 32, className }: { size?: number; className?: string }) {
  const gradientId = useId()
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="status"
      aria-label="Loading"
      className={cn('animate-pulse', className)}
      style={{ animationDuration: '1.4s' }}
    >
      <defs>
        <linearGradient id={gradientId} x1="6" y1="6" x2="44" y2="44" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#0284C7" />
          <stop offset="60%" stopColor="#2563EB" />
          <stop offset="100%" stopColor="#F97316" />
        </linearGradient>
      </defs>
      <g
        stroke={`url(#${gradientId})`}
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M9 13h6.2l4 17.2c.3 1.2 1.4 2.1 2.6 2.1H35a2.8 2.8 0 0 0 2.7-2.2l2.5-11.6a1.6 1.6 0 0 0-1.6-1.9H18" />
        <path d="M24 32h-5.5" />
        <circle cx="21" cy="37" r="3" />
        <circle cx="33" cy="37" r="3" />
        <path d="M31 8l6-2.5 2.5 6L34 14l-3-6z" />
        <path d="M9 24l4-1.6 1.6 4L10.6 28 9 24z" />
      </g>
      <text
        x="24"
        y="24"
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize="9"
        fontWeight="700"
        fontFamily="'Inter','Segoe UI',sans-serif"
        fill={`url(#${gradientId})`}
      >
        CP
      </text>
    </svg>
  )
}
