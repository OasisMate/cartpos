'use client'

import { useEffect } from 'react'

export function DirectionSetter() {
  useEffect(() => {
    // Set direction on initial load based on saved language
    const savedLang = localStorage.getItem('language')
    if (savedLang === 'ur') {
      document.documentElement.dir = 'rtl'
      document.documentElement.lang = 'ur'
    } else {
      document.documentElement.dir = 'ltr'
      document.documentElement.lang = 'en'
    }
  }, [])

  return null
}


