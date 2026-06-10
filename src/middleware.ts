import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { jwtVerify } from 'jose'

const secretKey = process.env.JWT_SECRET
if (!secretKey || secretKey.length < 32) {
  throw new Error('JWT_SECRET must be set to a strong value (at least 32 characters).')
}
const encodedKey = new TextEncoder().encode(secretKey)

async function validateSession(sessionCookie: string | undefined): Promise<boolean> {
  if (!sessionCookie) {
    return false
  }

  try {
    await jwtVerify(sessionCookie, encodedKey, {
      algorithms: ['HS256'],
    })
    return true
  } catch (error) {
    // Invalid or expired token
    return false
  }
}

export async function middleware(request: NextRequest) {
  const sessionCookie = request.cookies.get('session')?.value
  const { pathname } = request.nextUrl

  // Handle missing icon requests to prevent 404 spam
  if (pathname === '/icon-192x192.png') {
    return new NextResponse(null, { status: 204 })
  }

  // Allow static icon files to be served without authentication
  if (pathname === '/icon.svg' || pathname.startsWith('/icon')) {
    return NextResponse.next()
  }

  // Public routes that don't require authentication
  const publicRoutes = ['/login', '/signup', '/verify-email', '/api/health']
  const isPublicRoute = publicRoutes.includes(pathname)

  // Allow API routes to handle their own auth
  if (pathname.startsWith('/api/')) {
    return NextResponse.next()
  }

  // Validate the session token
  const hasValidSession = await validateSession(sessionCookie)

  // If no valid session and trying to access protected route (including root), redirect to login
  if (!hasValidSession && !isPublicRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    // Clear invalid session + stale shop/org selection so the next user
    // doesn't inherit a shop they can't access.
    const response = NextResponse.redirect(url)
    response.cookies.delete('session')
    response.cookies.delete('currentShopId')
    response.cookies.delete('currentOrgId')
    return response
  }

  // If valid session exists and on login page, redirect to home -
  // UNLESS ?clearSession=1 is present, which means a downstream page detected a
  // stale/deleted-user session and is asking us to clear it (prevents redirect loops).
  if (hasValidSession && pathname === '/login') {
    if (request.nextUrl.searchParams.get('clearSession')) {
      const response = NextResponse.next()
      response.cookies.delete('session')
      response.cookies.delete('currentShopId')
      response.cookies.delete('currentOrgId')
      return response
    }
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  // Expose the current path to server layouts (used to avoid duplicate breadcrumbs).
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-pathname', pathname)
  return NextResponse.next({ request: { headers: requestHeaders } })
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes) - handled above
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - icon.svg and other icon files (static assets)
     * - manifest.json, sw.js, workbox-* (PWA files fetched without credentials;
     *   redirecting these to /login broke the manifest and service-worker
     *   registration, i.e. offline mode)
     * - files in public directory (handled by Next.js static file serving)
     */
    '/((?!_next/static|_next/image|favicon.ico|icon|manifest.json|sw.js|workbox).*)',
  ],
}

