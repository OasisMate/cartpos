/**
 * Authentication-related constants
 */

/** Minimum password length enforced across signup, reset, and password-change flows. */
export const PASSWORD_MIN_LENGTH = 10

export const AUTH_HERO = {
  login: {
    title: 'Manage your retail shop with ease',
    subtitle: 'CartPOS - Offline-first Point of Sale system',
    description:
      'Fast billing, stock control, udhaar tracking, and daily summaries. Works smoothly even when internet is down.',
  },
  signup: {
    title: 'Start managing your retail shop today',
    subtitle: 'CartPOS - Offline-first Point of Sale system',
    description:
      'Register your organization to get started with fast billing, stock control, udhaar tracking, and daily summaries.',
  },
} as const

export const AUTH_FORM = {
  login: {
    title: 'Welcome Back',
    subtitle: 'Sign in to your CartPOS account',
  },
  signup: {
    title: 'Create Organization',
    subtitle: 'Register your organization to get started',
  },
} as const

export const VALIDATION_MESSAGES = {
  required: 'This field is required',
  email: 'Please enter a valid email address',
  passwordMinLength: 'Password must be at least 10 characters',
  passwordMismatch: 'Passwords do not match',
  phone: 'Please enter a valid phone number',
  cnic: 'CNIC must be 13 digits',
} as const

