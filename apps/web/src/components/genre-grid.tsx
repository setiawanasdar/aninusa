import Link from "next/link";
import type { GenreDto } from "@aninusa/types";

export function GenreGrid({ genres }: { genres: GenreDto[] }) {
  if (!genres.length) return null;

  return (
    <section className="space-y-3" aria-labelledby="genre-collections-heading">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 id="genre-collections-heading" className="text-lg font-bold tracking-tight text-white sm:text-xl">
            Koleksi genre
          </h2>
          <p className="mt-0.5 text-xs text-white/45">Temukan anime sesuai selera Anda</p>
        </div>
        <Link href="/genre" className="text-xs font-semibold text-white/55 hover:text-accent">
          Semua genre
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        {genres.slice(0, 12).map((genre) => (
          <Link
            key={genre.id}
            href={`/genre/${genre.slug}`}
            className="group flex items-center justify-between rounded-lg border border-white/[0.07] bg-ink-800 px-3.5 py-3 transition-colors hover:border-accent/40 hover:bg-ink-750 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <span className="text-sm font-medium text-white/80 group-hover:text-white">{genre.name}</span>
            {genre.animeCount !== undefined && (
              <span className="text-[11px] tabular-nums text-white/35">{genre.animeCount}</span>
            )}
          </Link>
        ))}
      </div>
    </section>
  );
}
