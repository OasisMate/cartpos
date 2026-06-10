'use client'

import { useRef, useState } from 'react'

/** Six single-digit boxes that auto-advance and support paste/backspace. */
export function CodeInput({ onComplete, disabled }: { onComplete: (code: string) => void; disabled?: boolean }) {
  const [digits, setDigits] = useState<string[]>(['', '', '', '', '', ''])
  const refs = useRef<Array<HTMLInputElement | null>>([])

  function setAt(i: number, val: string) {
    const next = [...digits]
    next[i] = val
    setDigits(next)
    return next
  }

  function handleChange(i: number, raw: string) {
    const val = raw.replace(/\D/g, '')
    if (!val) {
      setAt(i, '')
      return
    }
    const next = setAt(i, val[val.length - 1])
    if (i < 5) refs.current[i + 1]?.focus()
    if (next.every((d) => d !== '')) onComplete(next.join(''))
  }

  function handleKeyDown(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace') {
      if (digits[i]) {
        setAt(i, '')
      } else if (i > 0) {
        refs.current[i - 1]?.focus()
        setAt(i - 1, '')
      }
    } else if (e.key === 'ArrowLeft' && i > 0) {
      refs.current[i - 1]?.focus()
    } else if (e.key === 'ArrowRight' && i < 5) {
      refs.current[i + 1]?.focus()
    }
  }

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (!text) return
    e.preventDefault()
    const next = ['', '', '', '', '', '']
    for (let i = 0; i < text.length; i++) next[i] = text[i]
    setDigits(next)
    refs.current[Math.min(text.length, 5)]?.focus()
    if (text.length === 6) onComplete(text)
  }

  return (
    <div className="flex justify-center gap-2" onPaste={handlePaste}>
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el
          }}
          type="text"
          inputMode="numeric"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          maxLength={1}
          value={d}
          disabled={disabled}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onFocus={(e) => e.target.select()}
          className="w-11 h-14 text-center text-2xl font-semibold border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-orange-400 disabled:bg-gray-100"
        />
      ))}
    </div>
  )
}
