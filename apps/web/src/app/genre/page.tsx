import type { Metadata } from "next";
import Link from "next/link";
import { listGenres } from "@/lib/catalog";

export const metadata: Metadata = {
  title: "Genre anime",
  description: "Jelajahi anime berdasarkan genre: action, adventure, comedy, fantasy, romance, dan lainnya.",
  alternates: { canonical: "/genre" },
};

export const revalidate = 600;

export default async function GenreIndexPage() {
  const genres = await listGenres();

  return (
    <div className="container-page space-y-6 py-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl">Genre anime</h1>
        <p className="text-sm text-white/50">Pilih genre untuk menemukan judul berikutnya.</p>
      </header>

      {genres.length === 0 ? (
        <div className="surface px-6 py-14 text-center text-sm text-white/50">
          Belum ada genre. Jalankan sinkronisasi katalog terlebih dahulu.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {genres.map((genre) => (
            <Link
              key={genre.id}
              href={`/genre/${genre.slug}`}
              className="group flex items-center justify-between rounded-lg border border-white/[0.07] bg-ink-800 px-4 py-3.5 transition-colors hover:border-accent/40 hover:bg-ink-750 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <span className="text-sm font-medium text-white/85 group-hover:text-white">{genre.name}</span>
              <span className="text-xs tabular-nums text-white/35">{genre.animeCount ?? 0}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
