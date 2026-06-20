import { Logo } from '@/components/ui/Logo'
import { ReactNode } from 'react'

interface AuthFormContainerProps {
  title: string
  subtitle: string
  children: ReactNode
}

export function AuthFormContainer({ title, subtitle, children }: AuthFormContainerProps) {
  return (
    <div className="flex-1 bg-gray-50 flex items-center justify-center px-5 py-8 sm:p-8 md:p-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-6 sm:mb-8">
          <Logo showText className="justify-center mb-3 sm:mb-4" href="/" />
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-1 sm:mb-2">{title}</h2>
          <p className="text-sm sm:text-base text-gray-600">{subtitle}</p>
        </div>
        {children}
      </div>
    </div>
  )
}

