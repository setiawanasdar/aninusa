"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BookOpen, Tv } from "lucide-react";

const MODES = [
  { id: "anime", label: "Anime", icon: Tv, href: "/" },
  { id: "manga", label: "Manga", icon: BookOpen, href: "/manga" },
] as const;

export function ModeSwitcher() {
  const pathname = usePathname();
  const router = useRouter();
  const [, startTransition] = useTransition();
  const isManga = pathname.startsWith("/manga");
  const [activeTab, setActiveTab] = useState<"anime" | "manga">(isManga ? "manga" : "anime");

  // Keep state synchronized with URL changes
  useEffect(() => {
    setActiveTab(pathname.startsWith("/manga") ? "manga" : "anime");
  }, [pathname]);

  // Prefetch both mode targets for instant, zero-delay switching
  useEffect(() => {
    router.prefetch("/");
    router.prefetch("/manga");
  }, [router]);

  const activeIndex = activeTab === "manga" ? 1 : 0;

  const handleSwitch = (e: React.MouseEvent, href: string, modeId: "anime" | "manga") => {
    if (activeTab === modeId) return;
    e.preventDefault();
    // Immediate visual indicator slide
    setActiveTab(modeId);
    startTransition(() => {
      router.push(href);
    });
  };

  return (
    <div
      className="relative flex shrink-0 items-center rounded-full border border-white/10 bg-ink-900/90 p-0.5 shadow-inner backdrop-blur-md"
      role="tablist"
      aria-label="Pilih mode AniNusa"
    >
      {/* Sliding indicator */}
      <div
        className="absolute top-0.5 bottom-0.5 rounded-full bg-accent shadow-md shadow-accent/25 transition-all duration-300 ease-out"
        style={{
          left: `calc(${activeIndex * 50}% + 2px)`,
          width: "calc(50% - 4px)",
        }}
        aria-hidden="true"
      />

      {MODES.map((mode) => {
        const Icon = mode.icon;
        const isActive = activeTab === mode.id;
        return (
          <Link
            key={mode.id}
            href={mode.href}
            onClick={(e) => handleSwitch(e, mode.href, mode.id)}
            role="tab"
            aria-selected={isActive}
            className={`relative z-10 flex items-center gap-1 sm:gap-1.5 rounded-full px-2 sm:px-3.5 py-0.5 sm:py-1.5 text-[11px] sm:text-xs font-bold transition-colors duration-200 ${
              isActive ? "text-white" : "text-white/60 hover:text-white/90"
            }`}
          >
            <Icon className="h-3 w-3 sm:h-3.5 sm:w-3.5 shrink-0" aria-hidden="true" />
            <span>{mode.label}</span>
          </Link>
        );
      })}
    </div>
  );
}
