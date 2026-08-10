/**
 * Routes reachable without a session, in one place.
 *
 * Two guards enforce auth: `middleware.ts` (server, runs first) and the
 * `AuthContext` fallback (client, catches client-side navigation). They must
 * agree. When they drifted, a logged-out visitor could load a public page past
 * the middleware and then get bounced to /login by the client guard, which broke
 * every emailed link: verify-email, reset-password and shared receipts.
 */
export const PUBLIC_ROUTES = [
  '/login',
  '/signup',
  '/verify-email',
  '/forgot-password',
  '/reset-password',
  '/api/health',
] as const

/**
 * True when the path needs no session. `/r/<token>` is a public shareable
 * receipt (the token is signed, so it is unguessable).
 */
export function isPublicRoute(pathname: string): boolean {
  return (PUBLIC_ROUTES as readonly string[]).includes(pathname) || pathname.startsWith('/r/')
}
