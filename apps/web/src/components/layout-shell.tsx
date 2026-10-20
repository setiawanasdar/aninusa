"use client";

import { usePathname } from "next/navigation";
import type { UserDto } from "@aninusa/types";
import { SiteHeader } from "./site-header";
import { MangaHeader } from "./manga/manga-header";
import { MangaFooter } from "./manga/manga-footer";

interface LayoutShellProps {
  user: Pick<UserDto, "id" | "username" | "role" | "avatar"> | null;
  footer: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Unified layout shell that handles seamless mode transitions between Anime and Manga.
 * Renders the matching header, footer, and a smooth cross-fade page container.
 */
export function LayoutShell({ user, footer, children }: LayoutShellProps) {
  const pathname = usePathname();
  const isManga = pathname.startsWith("/manga");
  const isReader = pathname.startsWith("/manga/read");

  return (
    <>
      {/* Header Container - Smooth in-place transition */}
      {!isManga ? (
        <SiteHeader user={user} />
      ) : !isReader ? (
        <MangaHeader />
      ) : null}

      {/* Main Content with smooth mode transition animation */}
      <main
        id="main-content"
        key={isManga ? "mode-manga" : "mode-anime"}
        className="flex-1 animate-mode-enter"
      >
        {children}
      </main>

      {/* Footer Container */}
      {!isManga ? footer : !isReader ? <MangaFooter /> : null}
    </>
  );
}
