import { type NextRequest, NextResponse } from 'next/server'
import { verifyToken, SESSION_COOKIE } from '@/lib/auth/token'

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl

  const isProtected = pathname.startsWith('/dashboard')
  const isOnLogin = pathname.startsWith('/login')
  const isOnRegister = pathname.startsWith('/register')

  const token = req.cookies.get(SESSION_COOKIE)?.value
  const sessionId = token ? await verifyToken(token) : null
  const isLoggedIn = !!sessionId

  if (isProtected && !isLoggedIn) {
    const loginUrl = new URL('/login', req.url)
    loginUrl.searchParams.set('callbackUrl', pathname)
    return NextResponse.redirect(loginUrl)
  }

  if ((isOnLogin || isOnRegister) && isLoggedIn) {
    return NextResponse.redirect(new URL('/dashboard', req.url))
  }
}

export const config = {
  matcher: ['/dashboard/:path*', '/login', '/register'],
}
