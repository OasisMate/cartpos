// Simple CUID generator for client-side use
// This is a simplified version - for production, consider using @paralleldrive/cuid2
let counter = 0
const randomChars = '0123456789abcdefghijklmnopqrstuvwxyz'

function randomString(length: number): string {
  let result = ''
  for (let i = 0; i < length; i++) {
    result += randomChars[Math.floor(Math.random() * randomChars.length)]
  }
  return result
}

function getTimestamp(): string {
  return Date.now().toString(36)
}

function getCounter(): string {
  counter = (counter + 1) % 36
  return counter.toString(36)
}

function getFingerprint(): string {
  // Simplified fingerprint - in production, use a more stable identifier
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('cuid_fingerprint')
    if (stored) return stored
    const fingerprint = randomString(4)
    localStorage.setItem('cuid_fingerprint', fingerprint)
    return fingerprint
  }
  return randomString(4)
}

export function cuid(): string {
  const timestamp = getTimestamp()
  const counter = getCounter()
  const fingerprint = getFingerprint()
  const random = randomString(4)
  return `c${timestamp}${counter}${fingerprint}${random}`
}
