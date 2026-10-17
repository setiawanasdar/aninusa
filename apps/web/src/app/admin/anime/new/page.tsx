import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { AnimeForm } from "@/components/admin/anime-form";
import { requireAdminPage } from "@/lib/page-auth";

export default async function NewAnimePage() {
  await requireAdminPage("/admin/anime/new");

  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <Link href="/admin/anime" className="flex items-center gap-1 text-xs text-white/45 hover:text-white">
          <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" /> Kembali ke daftar
        </Link>
        <h1 className="text-2xl font-extrabold tracking-tight text-white">Tambah anime</h1>
        <p className="text-sm text-white/45">
          Slug dibuat otomatis dari judul. Metadata manual ini tidak memerlukan provider.
        </p>
      </header>

      <div className="surface p-5">
        <AnimeForm />
      </div>
    </div>
  );
}
