import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SubmitButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean
  loadingText?: string
  variant?: 'primary' | 'secondary' | 'danger'
}

export function SubmitButton({
  loading = false,
  loadingText,
  variant = 'primary',
  children,
  className,
  disabled,
  ...props
}: SubmitButtonProps) {
  const baseStyles = 'w-full font-semibold py-3 px-4 rounded-lg transition-colors duration-200 focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2'

  const variantStyles = {
    primary: 'bg-orange-500 hover:bg-orange-600 text-white focus:ring-orange-500',
    secondary: 'bg-gray-200 hover:bg-gray-300 text-gray-900 focus:ring-gray-500',
    danger: 'bg-red-500 hover:bg-red-600 text-white focus:ring-red-500',
  }

  return (
    <button
      type="submit"
      disabled={disabled || loading}
      className={cn(baseStyles, variantStyles[variant], className)}
      {...props}
    >
      {loading && <Loader2 className="w-4 h-4 animate-spin" />}
      {loading ? loadingText || 'Loading...' : children}
    </button>
  )
}

