import type { Metadata } from 'next'
import './globals.css'
import { AuthProvider } from '@/contexts/AuthContext'
import { SyncBootstrapper } from '@/components/SyncBootstrapper'
import { ToastProvider } from '@/components/ui/ToastProvider'
import ConditionalLayout from '@/components/layout/ConditionalLayout'

export const metadata: Metadata = {
  title: 'CartPOS',
  description: 'Offline-first POS for small retail shops',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'CartPOS',
  },
  icons: {
    apple: '/icon-192x192.png',
  },
}

export const viewport = {
  themeColor: '#2563eb',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="bg-gray-50">
                <ToastProvider>
                  <AuthProvider>
                    <SyncBootstrapper />
                    <ConditionalLayout>
                      {children}
                    </ConditionalLayout>
                  </AuthProvider>
                </ToastProvider>
      </body>
    </html>
  )
}

