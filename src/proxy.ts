import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";
import { SESSION_COOKIE, verifySession } from "@/lib/session";

// First line of defence: send logged-out visitors to /login with a real 307
// before any admin page renders. Every page and action still calls
// requireAdmin() itself, so this is a convenience layer, not the only gate.
export async function proxy(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (token && (await verifySession(token, env().SESSION_SECRET))) {
    return NextResponse.next();
  }
  return NextResponse.redirect(new URL("/login", request.url));
}

export const config = {
  // Public: /login, the share pages (/s, /p), and static / PWA assets.
  matcher: [
    "/((?!login|s/|p/|_next/|favicon\\.ico|manifest\\.webmanifest|sw\\.js|offline|.*\\.(?:png|svg|ico|webp|jpg|jpeg)$).*)",
  ],
};
