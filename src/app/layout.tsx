import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'CartPOS',
  description: 'Offline-first POS for small retail shops',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}

