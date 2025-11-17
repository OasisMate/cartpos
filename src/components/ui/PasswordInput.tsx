import React, { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { FormInput, FormInputProps } from './FormInput'
import { cn } from '@/lib/utils'

interface PasswordInputProps extends Omit<FormInputProps, 'type'> {
  showToggle?: boolean
}

export const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ showToggle = true, className, ...props }, ref) => {
    const [showPassword, setShowPassword] = useState(false)

    return (
      <div className="relative">
        <FormInput
          ref={ref}
          type={showPassword ? 'text' : 'password'}
          className={cn('pr-12', className)}
          {...props}
        />
        {showToggle && (
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-500 hover:text-gray-700 focus:outline-none transition-colors"
            disabled={props.disabled}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? (
              <EyeOff className="w-5 h-5" />
            ) : (
              <Eye className="w-5 h-5" />
            )}
          </button>
        )}
      </div>
    )
  }
)

PasswordInput.displayName = 'PasswordInput'

