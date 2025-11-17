import { AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ErrorAlertProps {
  message: string
  className?: string
  onDismiss?: () => void
}

export function ErrorAlert({ message, className, onDismiss }: ErrorAlertProps) {
  if (!message) return null

  return (
    <div
      className={cn(
        'rounded-lg bg-red-50 border border-red-200 p-4 flex items-start gap-3',
        className
      )}
      role="alert"
    >
      <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
      <div className="flex-1">
        <p className="text-sm text-red-600">{message}</p>
      </div>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="text-red-600 hover:text-red-800 focus:outline-none"
          aria-label="Dismiss error"
        >
          ×
        </button>
      )}
    </div>
  )
}

