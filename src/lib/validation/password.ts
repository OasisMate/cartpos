import { PASSWORD_MIN_LENGTH } from '@/constants/auth'

// A small blocklist of obvious/common passwords (lowercased). Server still
// enforces complexity, so this just stops the most guessable choices.
const COMMON_PASSWORDS = new Set([
  'password', 'password1', 'password123', 'passw0rd', 'p@ssw0rd', 'p@ssword',
  'qwerty', 'qwerty123', 'admin', 'admin123', 'welcome', 'welcome1', 'welcome123',
  'letmein', 'iloveyou', 'abc123', 'abc12345', '12345678', '123456789', '1234567890',
  'cartpos', 'cartpos123', 'changeme', 'secret', 'login', 'master', 'dragon',
])

/** True for passwords that are common, repetitive, or trivially sequential. */
export function isCommonPassword(pw: string): boolean {
  const low = pw.toLowerCase()
  if (COMMON_PASSWORDS.has(low)) return true
  if (/^(.)\1+$/.test(pw)) return true // all the same character (aaaaaaaaaa)
  if (/^(0123456789|1234567890|abcdefghij|qwertyuiop)/i.test(low)) return true
  // starts with a well-known weak base + trailing digits/symbols (e.g. Password123!)
  if (/^(password|cartpos|qwerty|admin|welcome|letmein|iloveyou)[0-9!@#$%^&*]*$/i.test(low)) return true
  return false
}

export interface PasswordCheck {
  ok: boolean
  errors: string[]
}

/** The full strict policy. Used both client-side (feedback) and server-side (enforcement). */
export function validatePassword(pw: string): PasswordCheck {
  const errors: string[] = []
  if (typeof pw !== 'string' || pw.length < PASSWORD_MIN_LENGTH) {
    errors.push(`Be at least ${PASSWORD_MIN_LENGTH} characters`)
  }
  if (!/[a-z]/.test(pw)) errors.push('Include a lowercase letter')
  if (!/[A-Z]/.test(pw)) errors.push('Include an uppercase letter')
  if (!/[0-9]/.test(pw)) errors.push('Include a number')
  if (!/[^A-Za-z0-9]/.test(pw)) errors.push('Include a symbol')
  if (pw && isCommonPassword(pw)) errors.push('Not be a common or easily guessed password')
  return { ok: errors.length === 0, errors }
}

/** One-line message for server responses. */
export function passwordPolicyError(pw: string): string | null {
  const { ok, errors } = validatePassword(pw)
  if (ok) return null
  return `Password must: ${errors.join('; ')}.`
}

/** Individual requirement checks for a live checklist UI. */
export function passwordRequirements(pw: string): { label: string; met: boolean }[] {
  return [
    { label: `At least ${PASSWORD_MIN_LENGTH} characters`, met: pw.length >= PASSWORD_MIN_LENGTH },
    { label: 'Uppercase letter', met: /[A-Z]/.test(pw) },
    { label: 'Lowercase letter', met: /[a-z]/.test(pw) },
    { label: 'Number', met: /[0-9]/.test(pw) },
    { label: 'Symbol', met: /[^A-Za-z0-9]/.test(pw) },
    { label: 'Not a common password', met: pw.length > 0 && !isCommonPassword(pw) },
  ]
}

/** 0-4 strength score + label for a meter. */
export function passwordStrength(pw: string): { score: number; label: string } {
  if (!pw) return { score: 0, label: '' }
  const reqs = passwordRequirements(pw)
  const met = reqs.filter((r) => r.met).length
  let score = Math.max(0, met - 2) // 6 reqs -> 0..4
  if (pw.length >= 14 && score < 4) score += 1
  score = Math.min(4, score)
  const labels = ['Very weak', 'Weak', 'Fair', 'Good', 'Strong']
  return { score, label: labels[score] }
}
