"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Bookmark,
  Clock,
  LayoutDashboard,
  LogOut,
  Menu,
  Search,
  User as UserIcon,
  X,
} from "lucide-react";
import type { UserDto } from "@aninusa/types";
import { SearchBox } from "./search-box";

const NAV_ITEMS = [
  { href: "/", label: "Beranda" },
  { href: "/browse", label: "Jelajah" },
  { href: "/season", label: "Musim" },
  { href: "/genre", label: "Genre" },
  { href: "/manga", label: "Manga & Komik" },
];

interface SiteHeaderProps {
  user: Pick<UserDto, "id" | "username" | "role" | "avatar"> | null;
}

export function SiteHeader({ user }: SiteHeaderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
    setSearchOpen(false);
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setMenuOpen(false);
    router.refresh();
    router.push("/");
  };

  return (
    <header
      className={`sticky top-0 z-50 border-b transition-colors duration-200 ${
        scrolled || mobileOpen
          ? "border-white/10 bg-ink-950/95 backdrop-blur-md"
          : "border-transparent bg-gradient-to-b from-ink-950/90 to-transparent"
      }`}
    >
      <div className="container-page flex h-16 items-center gap-3 sm:gap-5">
        <Link href="/" className="flex shrink-0 items-center" aria-label="AniNusa beranda">
          <span className="text-[17px] font-extrabold tracking-tight text-white">
            Ani<span className="text-accent">Nusa</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Navigasi utama">
          {NAV_ITEMS.map((item) => {
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  active ? "bg-white/[0.08] text-white" : "text-white/60 hover:bg-white/[0.05] hover:text-white"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto hidden w-full max-w-xs lg:block">
          <SearchBox compact />
        </div>

        <div className="ml-auto flex items-center gap-1 lg:ml-2">
          <button
            type="button"
            onClick={() => setSearchOpen((open) => !open)}
            className="rounded-md p-2 text-white/70 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent lg:hidden"
            aria-label="Cari anime"
            aria-expanded={searchOpen}
          >
            <Search className="h-5 w-5" aria-hidden="true" />
          </button>

          {user && (user.role === "ADMIN" || user.role === "MODERATOR") && (
            <Link
              href="/admin"
              className="hidden items-center gap-1.5 rounded-lg border border-accent/40 bg-accent/15 px-3 py-1.5 text-xs font-semibold text-accent hover:bg-accent/25 sm:flex"
            >
              <LayoutDashboard className="h-3.5 w-3.5" aria-hidden="true" />
              Dasbor Admin
            </Link>
          )}

          {user ? (
            <div ref={menuRef} className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen((open) => !open)}
                className="flex items-center gap-2 rounded-md p-1.5 pr-2 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent/20 text-xs font-bold uppercase text-accent">
                  {user.username.slice(0, 1)}
                </span>
                <span className="hidden max-w-[8rem] truncate text-sm font-medium text-white/85 sm:block">
                  {user.username}
                </span>
              </button>

              {menuOpen && (
                <div
                  role="menu"
                  className="absolute right-0 top-[calc(100%+0.5rem)] w-56 overflow-hidden rounded-xl border border-white/10 bg-ink-850 py-1 shadow-2xl"
                >
                  <Link
                    href="/profile"
                    role="menuitem"
                    className="flex items-center gap-2.5 px-3 py-2.5 text-sm text-white/80 hover:bg-white/[0.06] hover:text-white"
                  >
                    <UserIcon className="h-4 w-4" aria-hidden="true" /> Profil saya
                  </Link>
                  <Link
                    href="/profile#favorites"
                    role="menuitem"
                    className="flex items-center gap-2.5 px-3 py-2.5 text-sm text-white/80 hover:bg-white/[0.06] hover:text-white"
                  >
                    <Bookmark className="h-4 w-4" aria-hidden="true" /> Favorit
                  </Link>
                  <Link
                    href="/profile#history"
                    role="menuitem"
                    className="flex items-center gap-2.5 px-3 py-2.5 text-sm text-white/80 hover:bg-white/[0.06] hover:text-white"
                  >
                    <Clock className="h-4 w-4" aria-hidden="true" /> Riwayat tonton
                  </Link>
                  {(user.role === "ADMIN" || user.role === "MODERATOR") && (
                    <Link
                      href="/admin"
                      role="menuitem"
                      className="flex items-center gap-2.5 px-3 py-2.5 text-sm text-white/80 hover:bg-white/[0.06] hover:text-white"
                    >
                      <LayoutDashboard className="h-4 w-4" aria-hidden="true" /> Admin
                    </Link>
                  )}
                  <button
                    type="button"
                    role="menuitem"
                    onClick={logout}
                    className="flex w-full items-center gap-2.5 border-t border-white/10 px-3 py-2.5 text-left text-sm text-white/70 hover:bg-white/[0.06] hover:text-white"
                  >
                    <LogOut className="h-4 w-4" aria-hidden="true" /> Keluar
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="hidden items-center gap-1 sm:flex">
              <Link href="/login" className="btn-ghost px-3 py-2 text-[13px]">
                Masuk
              </Link>
              <Link href="/register" className="btn-primary px-3.5 py-2 text-[13px]">
                Daftar
              </Link>
            </div>
          )}

          <button
            type="button"
            onClick={() => setMobileOpen((open) => !open)}
            className="rounded-md p-2 text-white/70 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent md:hidden"
            aria-label={mobileOpen ? "Tutup menu" : "Buka menu"}
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
          </button>
        </div>
      </div>

      {searchOpen && (
        <div className="border-t border-white/10 px-4 py-3 lg:hidden">
          <SearchBox autoFocus compact />
        </div>
      )}

      {mobileOpen && (
        <div className="border-t border-white/10 px-4 py-3 md:hidden">
          <nav className="space-y-1" aria-label="Navigasi seluler">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="block rounded-md px-3 py-2.5 text-sm font-medium text-white/75 hover:bg-white/[0.06] hover:text-white"
              >
                {item.label}
              </Link>
            ))}
            {user && (
              <div className="border-t border-white/10 pt-2 space-y-1">
                {(user.role === "ADMIN" || user.role === "MODERATOR") && (
                  <Link
                    href="/admin"
                    className="flex items-center gap-2 rounded-md px-3 py-2.5 text-sm font-semibold text-accent hover:bg-white/[0.06]"
                  >
                    <LayoutDashboard className="h-4 w-4" aria-hidden="true" />
                    Dasbor Admin
                  </Link>
                )}
                <Link
                  href="/profile"
                  className="flex items-center gap-2 rounded-md px-3 py-2.5 text-sm font-medium text-white/75 hover:bg-white/[0.06] hover:text-white"
                >
                  <UserIcon className="h-4 w-4" aria-hidden="true" />
                  Profil saya ({user.username})
                </Link>
                <button
                  type="button"
                  onClick={logout}
                  className="flex w-full items-center gap-2 rounded-md px-3 py-2.5 text-left text-sm text-red-400 hover:bg-white/[0.06]"
                >
                  <LogOut className="h-4 w-4" aria-hidden="true" />
                  Keluar
                </button>
              </div>
            )}
            {!user && (
              <div className="grid grid-cols-2 gap-2 pt-2">
                <Link href="/login" className="btn-secondary">
                  Masuk
                </Link>
                <Link href="/register" className="btn-primary">
                  Daftar
                </Link>
              </div>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
