import React from 'react'
import { cn } from '@/lib/utils'

interface ToggleProps {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
  className?: string
}

export function Toggle({ label, checked, onChange, disabled, className }: ToggleProps) {
  return (
    <label className={cn('flex items-center cursor-pointer group w-full', className)}>
      <div className="relative flex-shrink-0">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="sr-only"
          disabled={disabled}
        />
        <div
          className={cn(
            'w-11 h-6 rounded-full transition-colors duration-200 ease-in-out relative',
            checked ? 'bg-green-500' : 'bg-gray-300 group-hover:bg-gray-400',
            disabled && 'opacity-50 cursor-not-allowed'
          )}
        >
          <div
            className={cn(
              'absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-md transform transition-transform duration-200 ease-in-out',
              checked ? 'translate-x-5' : 'translate-x-0'
            )}
          />
        </div>
      </div>
      <span className="ml-3 text-sm text-gray-700 font-medium">{label}</span>
    </label>
  )
}

