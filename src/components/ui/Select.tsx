import * as React from 'react'
import { cn } from '@/lib/utils'

export type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement>

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className = '', children, ...props }, ref) => {
    return (
      <select
        ref={ref}
        className={cn('input h-9', className)}
        {...props}
      >
        {children}
      </select>
    )
  }
)
Select.displayName = 'Select'

export default Select
