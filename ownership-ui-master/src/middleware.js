import { NextResponse } from "next/server"

export function middleware(request) {
  const token = request.cookies.get("next-auth.session-token")

  if (!token && (request.nextUrl.pathname.startsWith("/admin") || request.nextUrl.pathname.startsWith("/user"))) {
    return NextResponse.redirect(new URL("/", request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/admin/:path*","/user/:path*"] 
}