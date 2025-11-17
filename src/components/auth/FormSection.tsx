import { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface FormSectionProps {
  title: string
  children: ReactNode
  className?: string
}

export function FormSection({ title, children, className }: FormSectionProps) {
  return (
    <div className={cn('bg-white p-3 rounded-lg border border-gray-200', className)}>
      <h3 className="text-sm font-semibold text-gray-900 mb-2">{title}</h3>
      {children}
    </div>
  )
}

