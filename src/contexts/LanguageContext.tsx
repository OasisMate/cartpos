'use client'

import React, { createContext, useContext, useState, useEffect } from 'react'
import { translations, Language } from '@/lib/i18n/translations'

interface LanguageContextType {
    language: Language
    setLanguage: (lang: Language) => void
    t: (key: keyof typeof translations.en) => string
    isRTL: boolean
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined)

export function LanguageProvider({ children }: { children: React.ReactNode }) {
    const [language, setLanguage] = useState<Language>('en')

    useEffect(() => {
        const savedLang = localStorage.getItem('language') as Language
        if (savedLang && (savedLang === 'en' || savedLang === 'ur')) {
            setLanguage(savedLang)
            // Set document direction immediately on load
            document.documentElement.dir = savedLang === 'ur' ? 'rtl' : 'ltr'
            document.documentElement.lang = savedLang
        }
    }, [])

    const handleSetLanguage = (lang: Language) => {
        setLanguage(lang)
        localStorage.setItem('language', lang)
        // Update document direction
        document.documentElement.dir = lang === 'ur' ? 'rtl' : 'ltr'
        document.documentElement.lang = lang
    }

    const t = (key: keyof typeof translations.en) => {
        return translations[language][key] || translations['en'][key] || key
    }

    const isRTL = language === 'ur'

    return (
        <LanguageContext.Provider value={{ language, setLanguage: handleSetLanguage, t, isRTL }}>
            {children}
        </LanguageContext.Provider>
    )
}

export function useLanguage() {
    const context = useContext(LanguageContext)
    if (context === undefined) {
        throw new Error('useLanguage must be used within a LanguageProvider')
    }
    return context
}
