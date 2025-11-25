import { Logo } from '@/components/ui/Logo'
import { ReactNode } from 'react'

interface AuthFormContainerProps {
  title: string
  subtitle: string
  children: ReactNode
}

export function AuthFormContainer({ title, subtitle, children }: AuthFormContainerProps) {
  return (
    <div className="flex-1 bg-gray-50 flex items-center justify-center p-8 md:p-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Logo showText className="justify-center mb-4" href="/" />
          <h2 className="text-3xl font-bold text-gray-900 mb-2">{title}</h2>
          <p className="text-gray-600">{subtitle}</p>
        </div>
        {children}
      </div>
    </div>
  )
}

