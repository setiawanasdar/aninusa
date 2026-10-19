"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, Tv } from "lucide-react";

const MODES = [
  { id: "anime", label: "Anime", icon: Tv, href: "/" },
  { id: "manga", label: "Manga", icon: BookOpen, href: "/manga" },
] as const;

export function ModeSwitcher() {
  const pathname = usePathname();
  const isManga = pathname.startsWith("/manga");
  const activeIndex = isManga ? 1 : 0;

  return (
    <div className="relative flex items-center rounded-full border border-white/10 bg-ink-900/80 p-0.5">
      {/* Sliding indicator */}
      <div
        className="absolute top-0.5 bottom-0.5 rounded-full bg-accent/90 shadow-lg shadow-accent/20 transition-all duration-300 ease-out"
        style={{
          left: `calc(${activeIndex * 50}% + 2px)`,
          width: "calc(50% - 4px)",
        }}
        aria-hidden="true"
      />

      {MODES.map((mode, idx) => {
        const Icon = mode.icon;
        const isActive = idx === activeIndex;
        return (
          <Link
            key={mode.id}
            href={mode.href}
            className={`relative z-10 flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors duration-200 ${
              isActive ? "text-white" : "text-white/50 hover:text-white/75"
            }`}
            aria-current={isActive ? "page" : undefined}
          >
            <Icon className="h-3.5 w-3.5" aria-hidden="true" />
            {mode.label}
          </Link>
        );
      })}
    </div>
  );
}
