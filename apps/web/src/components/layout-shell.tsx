"use client";

import { usePathname } from "next/navigation";
import type { UserDto } from "@aninusa/types";
import { SiteHeader } from "./site-header";

interface LayoutShellProps {
  user: Pick<UserDto, "id" | "username" | "role" | "avatar"> | null;
  footer: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Client-side layout shell that conditionally renders SiteHeader and SiteFooter
 * only on anime routes. Manga routes have their own MangaHeader and MangaFooter.
 */
export function LayoutShell({ user, footer, children }: LayoutShellProps) {
  const pathname = usePathname();
  const isManga = pathname.startsWith("/manga");

  return (
    <>
      {!isManga && <SiteHeader user={user} />}
      <main id="main-content" className="flex-1">
        {children}
      </main>
      {!isManga && footer}
    </>
  );
}
