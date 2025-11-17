import { VALIDATION_MESSAGES } from '@/constants/auth'

export interface SignupFormData {
  firstName: string
  lastName: string
  email: string
  phone: string
  cnic: string
  isWhatsApp: boolean
  password: string
  confirmPassword: string
  organizationName: string
  legalName: string
  city: string
  addressLine1: string
  addressLine2: string
  ntn: string
  strn: string
  orgPhone: string
}

export function validateSignupForm(values: SignupFormData): Partial<Record<keyof SignupFormData, string>> {
  const errors: Partial<Record<keyof SignupFormData, string>> = {}

  // Required fields
  if (!values.firstName) errors.firstName = VALIDATION_MESSAGES.required
  if (!values.lastName) errors.lastName = VALIDATION_MESSAGES.required
  if (!values.email) errors.email = VALIDATION_MESSAGES.required
  if (!values.phone) errors.phone = VALIDATION_MESSAGES.required
  if (!values.cnic) errors.cnic = VALIDATION_MESSAGES.required
  if (!values.password) errors.password = VALIDATION_MESSAGES.required
  if (!values.organizationName) errors.organizationName = VALIDATION_MESSAGES.required
  if (!values.city) errors.city = VALIDATION_MESSAGES.required

  // Email validation
  if (values.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) {
    errors.email = VALIDATION_MESSAGES.email
  }

  // Password validation
  if (values.password && values.password.length < 6) {
    errors.password = VALIDATION_MESSAGES.passwordMinLength
  }

  // Password match
  if (values.password && values.confirmPassword && values.password !== values.confirmPassword) {
    errors.confirmPassword = VALIDATION_MESSAGES.passwordMismatch
  }

  return errors
}

