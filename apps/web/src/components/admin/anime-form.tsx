"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { ANIME_STATUSES, ANIME_TYPES, SEASONS, type AnimeDetail } from "@aninusa/types";

interface AnimeFormProps {
  anime?: AnimeDetail;
}

function toDateInput(value: string | null | undefined): string {
  if (!value) return "";
  return value.slice(0, 10);
}

export function AnimeForm({ anime }: AnimeFormProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    title: anime?.title ?? "",
    englishTitle: anime?.englishTitle ?? "",
    japaneseTitle: anime?.japaneseTitle ?? "",
    alternativeTitles: (anime?.alternativeTitles ?? []).join(", "),
    synopsis: anime?.synopsis ?? "",
    poster: anime?.poster ?? "",
    banner: anime?.banner ?? "",
    type: anime?.type ?? "TV",
    status: anime?.status ?? "COMPLETED",
    year: anime?.year ? String(anime.year) : "",
    season: anime?.season ?? "",
    score: anime?.score !== null && anime?.score !== undefined ? String(anime.score) : "",
    popularity: String(anime?.popularity ?? 0),
    source: anime?.source ?? "",
    duration: anime?.duration ? String(anime.duration) : "",
    totalEpisodes: anime?.totalEpisodes ? String(anime.totalEpisodes) : "",
    latestEpisode: anime?.latestEpisode !== null && anime?.latestEpisode !== undefined ? String(anime.latestEpisode) : "",
    airedFrom: toDateInput(anime?.airedFrom),
    airedTo: toDateInput(anime?.airedTo),
    malId: anime?.malId ? String(anime.malId) : "",
    anilistId: anime?.anilistId ? String(anime.anilistId) : "",
    genres: (anime?.genres ?? []).join(", "),
    studios: (anime?.studios ?? []).join(", "),
  });

  const update = (key: keyof typeof form, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setPending(true);
    setError(null);

    const payload = {
      title: form.title,
      englishTitle: form.englishTitle || null,
      japaneseTitle: form.japaneseTitle || null,
      alternativeTitles: form.alternativeTitles
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean),
      synopsis: form.synopsis || null,
      poster: form.poster || null,
      banner: form.banner || null,
      type: form.type,
      status: form.status,
      year: form.year ? Number(form.year) : null,
      season: form.season || null,
      score: form.score ? Number(form.score) : null,
      popularity: Number(form.popularity || 0),
      source: form.source || null,
      duration: form.duration ? Number(form.duration) : null,
      totalEpisodes: form.totalEpisodes ? Number(form.totalEpisodes) : null,
      latestEpisode: form.latestEpisode ? Number(form.latestEpisode) : null,
      airedFrom: form.airedFrom || null,
      airedTo: form.airedTo || null,
      malId: form.malId ? Number(form.malId) : null,
      anilistId: form.anilistId ? Number(form.anilistId) : null,
      genres: form.genres.split(",").map((value) => value.trim()).filter(Boolean),
      studios: form.studios.split(",").map((value) => value.trim()).filter(Boolean),
    };

    try {
      const response = await fetch(anime ? `/api/admin/anime/${anime.id}` : "/api/admin/anime", {
        method: anime ? "PUT" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });

      const body = (await response.json().catch(() => null)) as
        | { data?: { id: string }; error?: { message?: string; details?: Array<{ path: string; message: string }> } }
        | null;

      if (!response.ok) {
        const detail = body?.error?.details?.[0];
        setError(
          detail ? `${detail.path}: ${detail.message}` : body?.error?.message ?? "Gagal menyimpan anime.",
        );
        return;
      }

      router.push(`/admin/anime/${body?.data?.id ?? anime?.id ?? ""}`);
      router.refresh();
    } catch {
      setError("Tidak dapat menghubungi server.");
    } finally {
      setPending(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <span className="label">Judul *</span>
          <input className="input" required value={form.title} onChange={(event) => update("title", event.target.value)} />
        </label>

        <label className="block">
          <span className="label">Judul Inggris</span>
          <input className="input" value={form.englishTitle} onChange={(event) => update("englishTitle", event.target.value)} />
        </label>

        <label className="block">
          <span className="label">Judul Jepang</span>
          <input className="input" lang="ja" value={form.japaneseTitle} onChange={(event) => update("japaneseTitle", event.target.value)} />
        </label>

        <label className="block sm:col-span-2">
          <span className="label">Judul alternatif (pisahkan dengan koma)</span>
          <input className="input" value={form.alternativeTitles} onChange={(event) => update("alternativeTitles", event.target.value)} />
        </label>

        <label className="block sm:col-span-2">
          <span className="label">Sinopsis</span>
          <textarea
            className="input min-h-28"
            value={form.synopsis}
            onChange={(event) => update("synopsis", event.target.value)}
          />
        </label>

        <label className="block">
          <span className="label">URL poster</span>
          <input className="input" value={form.poster} onChange={(event) => update("poster", event.target.value)} placeholder="/art/... atau https://..." />
        </label>

        <label className="block">
          <span className="label">URL banner</span>
          <input className="input" value={form.banner} onChange={(event) => update("banner", event.target.value)} placeholder="/art/... atau https://..." />
        </label>

        <label className="block">
          <span className="label">Tipe</span>
          <select className="input" value={form.type} onChange={(event) => update("type", event.target.value)}>
            {ANIME_TYPES.map((type) => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="label">Status</span>
          <select className="input" value={form.status} onChange={(event) => update("status", event.target.value)}>
            {ANIME_STATUSES.map((status) => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="label">Tahun</span>
          <input className="input" type="number" min={1900} max={2100} value={form.year} onChange={(event) => update("year", event.target.value)} />
        </label>

        <label className="block">
          <span className="label">Musim</span>
          <select className="input" value={form.season} onChange={(event) => update("season", event.target.value)}>
            <option value="">—</option>
            {SEASONS.map((season) => (
              <option key={season} value={season}>{season}</option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="label">Rating (0–10)</span>
          <input className="input" type="number" min={0} max={10} step={0.1} value={form.score} onChange={(event) => update("score", event.target.value)} />
        </label>

        <label className="block">
          <span className="label">Popularitas</span>
          <input className="input" type="number" min={0} value={form.popularity} onChange={(event) => update("popularity", event.target.value)} />
        </label>

        <label className="block">
          <span className="label">Durasi per episode (menit)</span>
          <input className="input" type="number" min={1} max={600} value={form.duration} onChange={(event) => update("duration", event.target.value)} />
        </label>

        <label className="block">
          <span className="label">Total episode</span>
          <input className="input" type="number" min={0} value={form.totalEpisodes} onChange={(event) => update("totalEpisodes", event.target.value)} />
        </label>

        <label className="block">
          <span className="label">Episode terbaru</span>
          <input className="input" type="number" min={0} step={0.1} value={form.latestEpisode} onChange={(event) => update("latestEpisode", event.target.value)} />
        </label>

        <label className="block">
          <span className="label">Sumber metadata</span>
          <input className="input" value={form.source} onChange={(event) => update("source", event.target.value)} />
        </label>

        <label className="block">
          <span className="label">Tayang dari</span>
          <input className="input" type="date" value={form.airedFrom} onChange={(event) => update("airedFrom", event.target.value)} />
        </label>

        <label className="block">
          <span className="label">Tayang sampai</span>
          <input className="input" type="date" value={form.airedTo} onChange={(event) => update("airedTo", event.target.value)} />
        </label>

        <label className="block">
          <span className="label">MAL ID</span>
          <input className="input" type="number" value={form.malId} onChange={(event) => update("malId", event.target.value)} />
        </label>

        <label className="block">
          <span className="label">AniList ID</span>
          <input className="input" type="number" value={form.anilistId} onChange={(event) => update("anilistId", event.target.value)} />
        </label>

        <label className="block">
          <span className="label">Genre (pisahkan dengan koma)</span>
          <input className="input" value={form.genres} onChange={(event) => update("genres", event.target.value)} />
        </label>

        <label className="block">
          <span className="label">Studio (pisahkan dengan koma)</span>
          <input className="input" value={form.studios} onChange={(event) => update("studios", event.target.value)} />
        </label>
      </div>

      {error && (
        <p className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200" role="alert">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <button type="submit" disabled={pending} className="btn-primary">
          {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          {anime ? "Simpan perubahan" : "Buat anime"}
        </button>
        <button type="button" onClick={() => router.back()} className="btn-secondary">
          Batal
        </button>
      </div>
    </form>
  );
}
