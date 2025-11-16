export async function fetchJSON<T>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  })

  let data: any = null
  try {
    data = await response.json()
  } catch {
    // ignore body parse errors for empty responses
  }

  if (!response.ok) {
    const message =
      (data && (data.error || data.message)) ||
      `Request failed: ${response.status} ${response.statusText}`
    throw new Error(message)
  }

  return data as T
}

