import { cookies } from "next/headers";
import { loginSchema } from "@aninusa/types";
import { prisma } from "@/lib/db";
import {
  assertSameOrigin,
  enforceRateLimit,
  errorResponse,
  errors,
  json,
  noStoreHeaders,
  parseJson,
} from "@/lib/api";
import { cookieOptions, createSession, requestMetadata, verifyPassword } from "@/lib/auth";
import { serverEnv } from "@/lib/env";

export const runtime = "nodejs";

// A real bcrypt hash used only to equalize timing when the account does not
// exist, so the endpoint cannot be used to enumerate emails.
const DUMMY_PASSWORD_HASH = "$2b$12$Re5otM/Ud4doCrK5EFqCR.HSeNfRLZTbKWL8j73IatAiaQfvm5hu6";

export async function POST(request: Request) {
  try {
    await assertSameOrigin(request);
    await enforceRateLimit(request, "auth");

    const input = await parseJson(request, loginSchema);

    const user = await prisma.user.findUnique({
      where: { email: input.email },
      select: {
        id: true,
        username: true,
        email: true,
        avatar: true,
        role: true,
        passwordHash: true,
        createdAt: true,
      },
    });

    // Same response shape and comparable timing whether the account is missing
    // or the password is wrong.
    const valid = await verifyPassword(
      input.password,
      user?.passwordHash ?? DUMMY_PASSWORD_HASH,
    );
    if (!user || !valid) throw errors.unauthorized("Email atau password salah");

    const meta = await requestMetadata();
    const { token, maxAge } = await createSession(user.id, meta);
    const cookieStore = await cookies();
    cookieStore.set(serverEnv().SESSION_COOKIE_NAME, token, cookieOptions(maxAge));

    return json(
      {
        id: user.id,
        username: user.username,
        email: user.email,
        avatar: user.avatar,
        role: user.role,
        createdAt: user.createdAt.toISOString(),
      },
      { headers: noStoreHeaders() },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
