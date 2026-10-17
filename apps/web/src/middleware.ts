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
 */
export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
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

    return NextResponse.next();
  } catch {
    const response = NextResponse.redirect(loginUrl);
    response.cookies.set(cookieName, "", { path: "/", maxAge: 0 });
    return response;
  }
}

export const config = {
  matcher: ["/admin/:path*", "/profile/:path*"],
};
