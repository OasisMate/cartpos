import Link from 'next/link'
import { cn } from '@/lib/utils'

interface LogoProps {
  showText?: boolean
  className?: string
  href?: string
}

export function Logo({ showText = true, className, href = '/' }: LogoProps) {
  const logoContent = (
    <>
      <div className="h-8 w-8 bg-gradient-to-br from-blue-500 to-orange-500 rounded-lg flex items-center justify-center flex-shrink-0">
        <div className="h-4 w-4 bg-white rounded-sm relative">
          <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-1.5 h-2 bg-orange-500 rounded-b-sm"></div>
          <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 w-0.5 h-1.5 bg-red-500 rounded-t-sm"></div>
        </div>
      </div>
      {showText && (
        <span className="font-bold text-lg bg-gradient-to-r from-blue-600 to-orange-600 bg-clip-text text-transparent whitespace-pre transition-opacity duration-200">
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

