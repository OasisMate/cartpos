'use client'

import { useEffect } from 'react'

/**
 * Component to unregister service workers in development mode
 * This prevents caching issues during development
 */
export function ServiceWorkerCleanup() {
  useEffect(() => {
    if (process.env.NODE_ENV === 'development' && typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        registrations.forEach((registration) => {
          registration.unregister().then((success) => {
            if (success) {
              console.log('[Dev] Service worker unregistered to prevent caching issues')
            }
          })
        })
      })
    }
  }, [])

  return null
}

