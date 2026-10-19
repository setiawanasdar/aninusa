import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

const STAFF_ROLES = new Set(["ADMIN", "MODERATOR"]);

function secretKey(): Uint8Array {
  return new TextEncoder().encode(
    process.env.AUTH_SECRET ?? "missing-secret-missing-secret-missing-secret",
  );
}

/**
 * Edge gate for protected areas. It verifies the signed session JWT and the
 * role claim so a protected shell is never streamed to an anonymous visitor.
 * The pages still perform a database-backed session check (revocation, expiry)
 * because a JWT alone cannot be revoked.
 *
 * Also injects x-next-pathname so server components can read the current path.
 */
export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // Inject pathname header for server components (e.g. conditional layout rendering)
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-next-pathname", pathname);

  // Protected routes gate
  if (pathname.startsWith("/admin") || pathname.startsWith("/profile")) {
    const cookieName = process.env.SESSION_COOKIE_NAME ?? "aninusa_session";
    const token = request.cookies.get(cookieName)?.value;

    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", `${pathname}${search}`);

    if (!token) return NextResponse.redirect(loginUrl);

    try {
      const { payload } = await jwtVerify(token, secretKey(), {
        issuer: "aninusa",
        audience: "aninusa-web",
        clockTolerance: 30,
      });

      if (pathname.startsWith("/admin")) {
        const role = typeof payload.role === "string" ? payload.role : "";
        if (!STAFF_ROLES.has(role)) {
          return NextResponse.redirect(new URL("/", request.url));
        }
      }

      return NextResponse.next({
        request: { headers: requestHeaders },
      });
    } catch {
      const response = NextResponse.redirect(loginUrl);
      response.cookies.set(cookieName, "", { path: "/", maxAge: 0 });
      return response;
    }
  }

  // All other routes — just forward with pathname header
  return NextResponse.next({
    request: { headers: requestHeaders },
  });
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static, _next/image (Next.js internals)
     * - favicon.ico, icon.svg, etc. (static files)
     * - api routes (handled separately)
     */
    "/((?!_next/static|_next/image|favicon\\.ico|icon\\.svg|apple-touch-icon\\.png|api/).*)",
  ],
};

