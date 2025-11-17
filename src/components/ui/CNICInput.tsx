import React from 'react'
import { FormInput, FormInputProps } from './FormInput'
import { formatCNIC } from '@/lib/validation'

interface CNICInputProps extends Omit<FormInputProps, 'onChange' | 'value'> {
  value: string
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
}

export const CNICInput = React.forwardRef<HTMLInputElement, CNICInputProps>(
  ({ value, onChange, ...props }, ref) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const digits = e.target.value.replace(/\D/g, '')
      let formatted = digits
      
      if (digits.length > 5) {
        formatted = `${digits.slice(0, 5)}-${digits.slice(5)}`
      }
      if (digits.length > 12) {
        formatted = `${digits.slice(0, 5)}-${digits.slice(5, 12)}-${digits.slice(12, 13)}`
      }

      const syntheticEvent = {
        ...e,
        target: {
          ...e.target,
          value: formatted,
        },
      } as React.ChangeEvent<HTMLInputElement>

      onChange(syntheticEvent)
    }

    return (
      <FormInput
        ref={ref}
        value={value}
        onChange={handleChange}
        maxLength={15}
        placeholder="XXXXX-XXXXXXX-X"
        {...props}
      />
    )
  }
)

CNICInput.displayName = 'CNICInput'

