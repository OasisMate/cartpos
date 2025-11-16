import type { Metadata } from 'next'
import './globals.css'
import { AuthProvider } from '@/contexts/AuthContext'
import Navbar from '@/components/layout/Navbar'
import Sidebar from '@/components/layout/Sidebar'
import { SyncBootstrapper } from '@/components/SyncBootstrapper'

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
        <AuthProvider>
                  <SyncBootstrapper />
          <Navbar />
          <Sidebar />
          <main className="md:pl-64 pt-16">
            <div className="py-6">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
                <div className="bg-white rounded-lg shadow-sm p-6">
                  {children}
                </div>
              </div>
            </div>
          </main>
        </AuthProvider>
      </body>
    </html>
  )
}

