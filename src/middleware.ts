import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { jwtVerify } from 'jose'

const secretKey = process.env.JWT_SECRET || 'your-secret-key-change-in-production'
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

  // Public routes that don't require authentication
  const publicRoutes = ['/login', '/signup', '/api/health']
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
    // Clear invalid session cookie
    const response = NextResponse.redirect(url)
    response.cookies.delete('session')
    return response
  }

  // If valid session exists and on login page, redirect to home
  if (hasValidSession && pathname === '/login') {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes) - handled above
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}

