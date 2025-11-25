import Link from 'next/link'
import { cn } from '@/lib/utils'
import { useId } from 'react'

interface LogoProps {
  showText?: boolean
  className?: string
  href?: string
}

export function Logo({ showText = true, className, href = '/' }: LogoProps) {
  const gradientId = useId()
  const glowId = useId()

  const logoContent = (
    <>
      {/* CartPOS neon cart mark */}
      <div className="relative h-10 w-10 flex items-center justify-center">
        <div className="absolute inset-0 rounded-2xl bg-white/0 border border-white/40 shadow-[0_3px_12px_rgba(15,118,230,0.12)]" />
        <svg
          width={34}
          height={34}
          viewBox="0 0 48 48"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="relative"
        >
          <defs>
            <linearGradient id={gradientId} x1="6" y1="6" x2="44" y2="44" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#0284C7" />
              <stop offset="60%" stopColor="#2563EB" />
              <stop offset="100%" stopColor="#F97316" />
            </linearGradient>
            <filter id={glowId} x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur stdDeviation="3" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <g filter={`url(#${glowId})`} stroke={`url(#${gradientId})`} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 13h6.2l4 17.2c.3 1.2 1.4 2.1 2.6 2.1H35a2.8 2.8 0 0 0 2.7-2.2l2.5-11.6a1.6 1.6 0 0 0-1.6-1.9H18" />
            <path d="M24 32h-5.5" />
            <circle cx="21" cy="37" r="3" />
            <circle cx="33" cy="37" r="3" />
            {/* floating tags */}
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
      </div>
      {showText && (
        <span className="font-semibold text-lg tracking-tight bg-gradient-to-r from-sky-600 via-blue-700 to-orange-600 bg-clip-text text-transparent whitespace-pre transition-opacity duration-200">
          CartPOS
        </span>
      )}
    </>
  )

  return (
    <Link
      href={href}
      className={cn(
        'font-normal flex items-center text-sm text-gray-900 py-1 relative z-20 transition-all duration-200',
        showText ? 'space-x-2' : 'justify-center',
        className
      )}
    >
      {logoContent}
    </Link>
  )
}

