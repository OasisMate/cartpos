import { parsePhoneNumber, isValidPhoneNumber, type CountryCode } from 'libphonenumber-js'

/**
 * Normalize phone number to E.164 format
 * Returns null if invalid
 */
export function normalizePhone(phone: string, defaultCountry: CountryCode = 'PK'): string | null {
  try {
    if (!phone) return null
    const phoneNumber = parsePhoneNumber(phone, defaultCountry)
    if (phoneNumber && phoneNumber.isValid()) {
      return phoneNumber.format('E.164')
    }
    return null
  } catch {
    return null
  }
}

/**
 * Validate phone number format
 */
export function validatePhone(phone: string, defaultCountry: CountryCode = 'PK'): boolean {
  try {
    return isValidPhoneNumber(phone, defaultCountry)
  } catch {
    return false
  }
}

/**
 * Normalize CNIC: remove hyphens and spaces, keep only digits
 * CNIC format: XXXXX-XXXXXXX-X (13 digits)
 */
export function normalizeCNIC(cnic: string): string | null {
  if (!cnic) return null
  // Remove all non-digit characters
  const digits = cnic.replace(/\D/g, '')
  // CNIC must be exactly 13 digits
  if (digits.length === 13) {
    return digits
  }
  return null
}

/**
 * Format CNIC for display: XXXXX-XXXXXXX-X
 */
export function formatCNIC(cnic: string): string {
  if (!cnic) return ''
  const digits = cnic.replace(/\D/g, '')
  if (digits.length === 13) {
    return `${digits.slice(0, 5)}-${digits.slice(5, 12)}-${digits.slice(12)}`
  }
  return cnic
}

/**
 * Validate CNIC format (13 digits)
 */
export function validateCNIC(cnic: string): boolean {
  const normalized = normalizeCNIC(cnic)
  return normalized !== null && normalized.length === 13
}

