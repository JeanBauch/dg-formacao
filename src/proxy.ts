import { getSessionCookie } from "better-auth/cookies";
import { type NextRequest, NextResponse } from "next/server";
import { signInPath } from "@/domain/auth";

// The optimistic check at the edge (ADR-008, skill auth-identity): a request
// for a private page without the session cookie goes to the sign-in, which
// keeps the requested path to return to (A2.9). It reads no database: a cookie
// that is there but no longer valid passes, and the session gate of the data
// layer, which every private page starts with, decides.
export function proxy(request: NextRequest) {
  if (getSessionCookie(request)) return NextResponse.next();
  const { pathname, search } = request.nextUrl;
  return NextResponse.redirect(
    new URL(signInPath(`${pathname}${search}`), request.url),
  );
}

// The private pages, those of the (app) route group. A new private page joins
// this list; the static assets never match it.
export const config = {
  matcher: ["/conta/:path*"],
};
