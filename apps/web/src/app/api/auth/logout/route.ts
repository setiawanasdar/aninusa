import { cookies } from "next/headers";
import { assertSameOrigin, errorResponse, json, noStoreHeaders } from "@/lib/api";
import { destroySession, getSessionUser } from "@/lib/auth";
import { serverEnv } from "@/lib/env";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    await assertSameOrigin(request);

    const user = await getSessionUser();
    if (user) await destroySession(user.sessionId);

    const cookieStore = await cookies();
    cookieStore.set(serverEnv().SESSION_COOKIE_NAME, "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });

    return json({ ok: true }, { headers: noStoreHeaders() });
  } catch (error) {
    return errorResponse(error);
  }
}
