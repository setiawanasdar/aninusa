"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BookOpen, Flame, History, Layers, Search, X } from "lucide-react";
import { ModeSwitcher } from "@/components/mode-switcher";

export function MangaHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = query.trim();
    if (clean) {
      router.push(`/manga/search?q=${encodeURIComponent(clean)}`);
      setMobileSearchOpen(false);
    }
  };

  const navLinks = [
    { href: "/manga", label: "Beranda", icon: BookOpen },
    { href: "/manga?tab=popular", label: "Populer", icon: Flame },
    { href: "/manga?tab=latest", label: "Terbaru", icon: History },
    { href: "/manga/genre", label: "Genre", icon: Layers },
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-white/[0.08] bg-ink-950/95 backdrop-blur-md">
      <div className="container-page flex h-16 items-center gap-3 sm:gap-5">
        {/* Brand Logo */}
        <Link
          href="/manga"
          className="flex shrink-0 items-center gap-2"
          aria-label="AniNusa Manga beranda"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-tr from-accent to-red-500 text-white shadow-md shadow-accent/20">
            <BookOpen className="h-3.5 w-3.5" />
          </span>
          <span className="text-[17px] font-extrabold tracking-tight text-white">
            Ani<span className="text-accent">Nusa</span>{" "}
            <span className="hidden sm:inline-block text-[10px] font-bold uppercase tracking-wider text-accent border border-accent/30 bg-accent/15 px-1.5 py-0.5 rounded">
              Manga
            </span>
          </span>
        </Link>

        {/* Mode Switcher */}
        <ModeSwitcher />

        {/* Navigation Items */}
        <nav className="hidden items-center gap-1 md:flex" aria-label="Manga navigasi">
          {navLinks.map((item) => {
            const active =
              item.href === "/manga"
                ? pathname === "/manga"
                : pathname.startsWith(item.href.split("?")[0]) && item.href.includes("?")
                  ? false
                  : pathname === item.href.split("?")[0];
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  active
                    ? "bg-white/[0.08] text-white"
                    : "text-white/60 hover:bg-white/[0.05] hover:text-white"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Desktop Manga Search */}
        <div className="ml-auto hidden w-full max-w-xs lg:block">
          <form onSubmit={handleSearch} className="relative">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari komik, manga, manhwa..."
              className="w-full rounded-lg border border-white/10 bg-ink-850 px-3.5 py-2 pl-9 text-xs text-white placeholder-white/40 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
            />
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-white/40 pointer-events-none" />
          </form>
        </div>

        {/* Mobile Search Button */}
        <div className="ml-auto flex items-center gap-1 lg:hidden">
          <button
            type="button"
            onClick={() => setMobileSearchOpen(!mobileSearchOpen)}
            className="rounded-md p-2 text-white/70 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            aria-label="Cari komik"
          >
            {mobileSearchOpen ? <X className="h-5 w-5" /> : <Search className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Search Dropdown */}
      {mobileSearchOpen && (
        <div className="border-t border-white/[0.08] p-3 lg:hidden bg-ink-900">
          <form onSubmit={handleSearch} className="relative">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari manga, manhwa, manhua..."
              autoFocus
              className="w-full rounded-lg border border-white/10 bg-ink-950 px-3 py-2 pl-9 text-sm text-white placeholder-white/40 focus:border-accent focus:outline-none"
            />
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-white/40 pointer-events-none" />
          </form>
        </div>
      )}

      {/* Mobile Nav Bar */}
      <div className="flex md:hidden items-center gap-1 overflow-x-auto px-4 pb-2 pt-0 scrollbar-none border-t border-white/[0.04]">
        {navLinks.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-white/65 hover:bg-white/[0.06] hover:text-white"
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </header>
  );
}
