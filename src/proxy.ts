import { type NextRequest, NextResponse } from 'next/server'
import { verifyToken, SESSION_COOKIE } from '@/lib/auth/token'

const PUBLIC_PREFIXES = ['/login', '/register', '/api/auth']

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Pass through public paths
  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) {
    // Redirect logged-in users away from login/register
    if (pathname.startsWith('/login') || pathname.startsWith('/register')) {
      const token = req.cookies.get(SESSION_COOKIE)?.value
      const sessionId = token ? await verifyToken(token) : null
      if (sessionId) {
        return NextResponse.redirect(new URL('/dashboard', req.url))
      }
    }
    return NextResponse.next()
  }

  // These routes authenticate via their own secrets inside the route handler
  if (
    pathname === '/api/worker' ||
    pathname === '/api/cron/run' ||
    pathname === '/api/emails/inbound'
  ) {
    return NextResponse.next()
  }

  // All other /api/* and /dashboard/* require a valid session
  if (pathname.startsWith('/api/') || pathname.startsWith('/dashboard')) {
    const token = req.cookies.get(SESSION_COOKIE)?.value

    if (!token) {
      return unauthenticated(req, pathname)
    }

    const sessionId = await verifyToken(token)
    if (!sessionId) {
      // Token is tampered — clear cookie and bounce
      const res = unauthenticated(req, pathname)
      res.cookies.delete(SESSION_COOKIE)
      return res
    }

    // Forward session ID to route handlers to avoid a second HMAC verify
    const requestHeaders = new Headers(req.headers)
    requestHeaders.set('x-session-id', sessionId)

    const activeTeam = req.cookies.get('active_team')?.value
    if (activeTeam) {
      requestHeaders.set('x-active-team-id', activeTeam)
    }

    return NextResponse.next({ request: { headers: requestHeaders } })
  }

  return NextResponse.next()
}

function unauthenticated(req: NextRequest, pathname: string): NextResponse {
  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const loginUrl = req.nextUrl.clone()
  loginUrl.pathname = '/login'
  loginUrl.searchParams.set('callbackUrl', pathname)
  return NextResponse.redirect(loginUrl)
}

export const config = {
  matcher: ['/dashboard/:path*', '/api/:path*', '/login', '/register'],
}
