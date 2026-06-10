/**
 * Centralized API utilities for consistent error handling and request formatting
 */

export interface ApiError {
  error: string
  status?: number
}

export class ApiException extends Error {
  status: number
  /** Optional machine-readable code from the server (e.g. EMAIL_NOT_VERIFIED). */
  code?: string
  /** Full parsed error payload, for callers that need extra fields. */
  payload?: any

  constructor(message: string, status: number = 500, code?: string, payload?: any) {
    super(message)
    this.name = 'ApiException'
    this.status = status
    this.code = code
    this.payload = payload
  }
}

export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const defaultHeaders: HeadersInit = {
    'Content-Type': 'application/json',
  }

  const response = await fetch(endpoint, {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
  })

  const data = await response.json().catch(() => ({ error: 'Invalid response' }))

  if (!response.ok) {
    throw new ApiException(data.error || 'Request failed', response.status, data.code, data)
  }

  return data
}

export async function apiPost<T>(endpoint: string, body: unknown): Promise<T> {
  return apiRequest<T>(endpoint, {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function apiGet<T>(endpoint: string): Promise<T> {
  return apiRequest<T>(endpoint, {
    method: 'GET',
  })
}

