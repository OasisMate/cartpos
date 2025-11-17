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
          <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-500 rounded-lg mb-4">
            <div className="w-6 h-6 bg-white rounded-sm relative">
              <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-2 h-3 bg-orange-500 rounded-b-sm"></div>
              <div className="absolute bottom-3 left-1/2 transform -translate-x-1/2 w-1 h-2 bg-red-500 rounded-t-sm"></div>
            </div>
          </div>
          <h2 className="text-3xl font-bold text-gray-900 mb-2">{title}</h2>
          <p className="text-gray-600">{subtitle}</p>
        </div>
        {children}
      </div>
    </div>
  )
}

