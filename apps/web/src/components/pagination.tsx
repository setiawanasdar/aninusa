import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface PaginationProps {
  page: number;
  totalPages: number;
  basePath: string;
  searchParams: Record<string, string | undefined>;
}

function pageHref(basePath: string, searchParams: Record<string, string | undefined>, page: number): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (value && key !== "page") params.set(key, value);
  }
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `${basePath}?${query}` : basePath;
}

export function Pagination({ page, totalPages, basePath, searchParams }: PaginationProps) {
  if (totalPages <= 1) return null;

  const pages = new Set<number>([1, totalPages, page, page - 1, page + 1]);
  if (page <= 3) [2, 3, 4].forEach((value) => pages.add(value));
  if (page >= totalPages - 2) [totalPages - 1, totalPages - 2, totalPages - 3].forEach((value) => pages.add(value));

  const visible = Array.from(pages)
    .filter((value) => value >= 1 && value <= totalPages)
    .sort((a, b) => a - b);

  return (
    <nav className="flex items-center justify-center gap-1.5 pt-2" aria-label="Navigasi halaman">
      <Link
        href={pageHref(basePath, searchParams, Math.max(1, page - 1))}
        aria-disabled={page <= 1}
        className={`btn-secondary px-2.5 py-2 ${page <= 1 ? "pointer-events-none opacity-40" : ""}`}
        aria-label="Halaman sebelumnya"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
      </Link>

      {visible.map((value, index) => {
        const previous = visible[index - 1];
        const gap = previous !== undefined && value - previous > 1;
        return (
          <span key={value} className="flex items-center gap-1.5">
            {gap && <span className="px-1 text-xs text-white/30">…</span>}
            <Link
              href={pageHref(basePath, searchParams, value)}
              aria-current={value === page ? "page" : undefined}
              className={`inline-flex h-9 min-w-9 items-center justify-center rounded-md px-2 text-sm font-semibold transition-colors ${
                value === page
                  ? "bg-accent text-white"
                  : "border border-white/10 bg-white/[0.04] text-white/65 hover:bg-white/10 hover:text-white"
              }`}
            >
              {value}
            </Link>
          </span>
        );
      })}

      <Link
        href={pageHref(basePath, searchParams, Math.min(totalPages, page + 1))}
        aria-disabled={page >= totalPages}
        className={`btn-secondary px-2.5 py-2 ${page >= totalPages ? "pointer-events-none opacity-40" : ""}`}
        aria-label="Halaman berikutnya"
      >
        <ChevronRight className="h-4 w-4" aria-hidden="true" />
      </Link>
    </nav>
  );
}
