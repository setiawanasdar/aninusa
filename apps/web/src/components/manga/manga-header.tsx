"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BookOpen, Flame, History, Search, Tv, X } from "lucide-react";

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
    { href: "/manga", label: "Beranda Komik", icon: BookOpen },
    { href: "/manga?tab=popular", label: "Populer", icon: Flame },
    { href: "/manga?tab=latest", label: "Terbaru", icon: History },
  ];

  return (
    <header className="border-b border-white/[0.08] bg-ink-950/80 backdrop-blur-md">
      <div className="container-page flex h-14 items-center justify-between gap-4">
        {/* Left: Brand Badge & Sub-navigation */}
        <div className="flex items-center gap-6">
          <Link
            href="/manga"
            className="flex items-center gap-2 text-sm font-bold text-white transition-opacity hover:opacity-90"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-tr from-accent to-red-500 text-white shadow-md shadow-accent/20">
              <BookOpen className="h-4 w-4" />
            </span>
            <div className="flex flex-col">
              <span className="text-xs uppercase tracking-wider text-accent font-extrabold leading-none">
                AniNusa
              </span>
              <span className="text-sm font-extrabold leading-tight text-white">
                Manga & Komik
              </span>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-1" aria-label="Manga navigation">
            {navLinks.map((item) => {
              const active = pathname === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                    active
                      ? "bg-white/10 text-white"
                      : "text-white/60 hover:bg-white/[0.05] hover:text-white"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Right: Manga Search & Return to Anime */}
        <div className="flex items-center gap-2">
          {/* Desktop Search */}
          <form onSubmit={handleSearch} className="relative hidden sm:block w-56 md:w-64">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari judul komik..."
              className="w-full rounded-lg border border-white/10 bg-ink-900/90 px-3 py-1.5 pl-8 text-xs text-white placeholder-white/40 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
            <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-white/40 pointer-events-none" />
          </form>

          {/* Mobile Search Button */}
          <button
            type="button"
            onClick={() => setMobileSearchOpen(!mobileSearchOpen)}
            className="flex sm:hidden h-8 w-8 items-center justify-center rounded-lg border border-white/10 text-white/70 hover:bg-white/10"
            aria-label="Cari komik"
          >
            {mobileSearchOpen ? <X className="h-4 w-4" /> : <Search className="h-4 w-4" />}
          </button>

          {/* Back to Anime Button */}
          <Link
            href="/"
            className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-ink-900 px-3 py-1.5 text-xs font-semibold text-white/80 transition-colors hover:border-white/20 hover:bg-ink-800 hover:text-white"
          >
            <Tv className="h-3.5 w-3.5 text-accent" />
            <span className="hidden sm:inline">Nonton Anime</span>
          </Link>
        </div>
      </div>

      {/* Mobile Search Dropdown */}
      {mobileSearchOpen && (
        <div className="border-t border-white/[0.08] p-3 sm:hidden bg-ink-900">
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
    </header>
  );
}
