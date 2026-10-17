import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-white/10 bg-ink-900">
      <div className="container-page grid gap-8 py-10 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-3">
          <Link href="/" className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-[15px] font-black text-white">
              A
            </span>
            <span className="text-[17px] font-extrabold tracking-tight text-white">
              Ani<span className="text-accent">Nusa</span>
            </span>
          </Link>
          <p className="max-w-xs text-xs leading-relaxed text-white/45">
            Platform streaming anime untuk penonton Indonesia. Subtitle Indonesia, kualitas hingga 1080p, dan
            pengalaman menonton yang cepat di semua perangkat.
          </p>
        </div>

        <div>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-white/40">Jelajahi</h2>
          <ul className="space-y-2 text-sm text-white/60">
            <li><Link href="/browse" className="hover:text-white">Semua anime</Link></li>
            <li><Link href="/season" className="hover:text-white">Musim ini</Link></li>
            <li><Link href="/genre" className="hover:text-white">Genre</Link></li>
            <li><Link href="/search" className="hover:text-white">Pencarian</Link></li>
          </ul>
        </div>

        <div>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-white/40">Akun</h2>
          <ul className="space-y-2 text-sm text-white/60">
            <li><Link href="/login" className="hover:text-white">Masuk</Link></li>
            <li><Link href="/register" className="hover:text-white">Daftar</Link></li>
            <li><Link href="/profile" className="hover:text-white">Profil</Link></li>
            <li><Link href="/profile#history" className="hover:text-white">Lanjut menonton</Link></li>
          </ul>
        </div>

        <div>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-white/40">Lisensi &amp; sumber</h2>
          <p className="text-xs leading-relaxed text-white/45">
            AniNusa hanya menampilkan sumber video yang sah, berlisensi, domain publik, atau diizinkan untuk
            di-embed. Metadata anime dapat berasal dari AniList API resmi. Tidak ada DRM, autentikasi, atau
            pembatasan akses yang dilewati.
          </p>
        </div>
      </div>

      <div className="border-t border-white/10 py-5">
        <div className="container-page flex flex-col items-start justify-between gap-2 text-[11px] text-white/35 sm:flex-row sm:items-center">
          <p>© {new Date().getFullYear()} AniNusa. Dibuat untuk penonton Indonesia.</p>
          <p>Katalog demo memakai film terbuka Blender Foundation (CC BY).</p>
        </div>
      </div>
    </footer>
  );
}
