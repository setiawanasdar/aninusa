import "server-only";

import { redirect } from "next/navigation";
import type { Role } from "@aninusa/types";
import { getSessionUser } from "./auth";

/**
 * Page-level authorization.
 *
 * Next.js renders layouts and pages in parallel, so an auth check that lives
 * only in a layout can still let the page component run (and stream data into
 * the RSC payload) before the layout redirect happens. Every protected page
 * must therefore call one of these helpers before querying data.
 */
export async function requireUserPage(nextPath: string) {
  const user = await getSessionUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  return user;
}

export async function requireAdminPage(nextPath: string) {
  const user = await requireUserPage(nextPath);
  if (!isStaff(user.role)) redirect("/");
  return user;
}

export function isStaff(role: Role | undefined): boolean {
  return role === "ADMIN" || role === "MODERATOR";
}
