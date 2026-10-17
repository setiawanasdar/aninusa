"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  ChevronRight,
  Loader2,
  Plus,
  ShieldCheck,
  Subtitles,
  Video,
} from "lucide-react";
import type { EpisodeDto } from "@aninusa/types";
import { formatEpisodeNumber } from "@aninusa/utils";
import { DeleteButton } from "./delete-button";

interface SourceRow {
  id: string;
  provider: string;
  url: string;
  quality: number;
  format: string;
  codec: string | null;
  language: string;
  status: string;
  lastCheckedAt: string | null;
}

interface SubtitleRow {
  id: string;
  language: string;
  label: string;
  url: string;
  format: string;
  isDefault: boolean;
  status: string;
}

export interface AdminEpisodeRow extends EpisodeDto {
  sources: SourceRow[];
  subtitles: SubtitleRow[];
}

interface EpisodesManagerProps {
  animeId: string;
  episodes: AdminEpisodeRow[];
}

const statusColor: Record<string, string> = {
  ACTIVE: "text-emerald-300 bg-emerald-500/10",
  DEGRADED: "text-amber-300 bg-amber-500/10",
  BROKEN: "text-red-300 bg-red-500/10",
  DISABLED: "text-white/40 bg-white/[0.06]",
};

export function EpisodesManager({ animeId, episodes }: EpisodesManagerProps) {
  const router = useRouter();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showAddEpisode, setShowAddEpisode] = useState(false);
  const [editingEpisode, setEditingEpisode] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    episodeNumber: "",
    title: "",
    duration: "",
    thumbnail: "",
    airDate: "",
    introStart: "",
    introEnd: "",
    outroStart: "",
  });
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [episodeForm, setEpisodeForm] = useState({
    episodeNumber: String((episodes[episodes.length - 1]?.number ?? 0) + 1),
    title: "",
    duration: "",
    thumbnail: "",
    airDate: "",
    introStart: "",
    introEnd: "",
    outroStart: "",
  });

  const [sourceForm, setSourceForm] = useState({
    provider: "open-media",
    url: "",
    quality: "1080",
    format: "HLS",
    codec: "h264",
    language: "ja",
    status: "ACTIVE",
  });

  const [subtitleForm, setSubtitleForm] = useState({
    language: "id",
    label: "Bahasa Indonesia",
    url: "",
    format: "VTT",
    isDefault: true,
  });

  const request = async (url: string, method: string, body?: unknown) => {
    setBusy(url);
    setMessage(null);
    try {
      const response = await fetch(url, {
        method,
        headers: body ? { "content-type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const payload = (await response.json().catch(() => null)) as
        | { error?: { message?: string } }
        | null;
      if (!response.ok) {
        setMessage(payload?.error?.message ?? "Operasi gagal.");
        return false;
      }
      router.refresh();
      return true;
    } catch {
      setMessage("Tidak dapat menghubungi server.");
      return false;
    } finally {
      setBusy(null);
    }
  };

  const addEpisode = async (event: React.FormEvent) => {
    event.preventDefault();
    const ok = await request("/api/admin/episodes", "POST", {
      animeId,
      episodeNumber: Number(episodeForm.episodeNumber),
      title: episodeForm.title || null,
      duration: episodeForm.duration ? Number(episodeForm.duration) : null,
      thumbnail: episodeForm.thumbnail || null,
      airDate: episodeForm.airDate || null,
      introStart: episodeForm.introStart ? Number(episodeForm.introStart) : null,
      introEnd: episodeForm.introEnd ? Number(episodeForm.introEnd) : null,
      outroStart: episodeForm.outroStart ? Number(episodeForm.outroStart) : null,
    });
    if (ok) {
      setShowAddEpisode(false);
      setEpisodeForm((current) => ({ ...current, title: "", episodeNumber: String(Number(current.episodeNumber) + 1) }));
    }
  };

  const startEdit = (episode: AdminEpisodeRow) => {
    setExpanded(episode.id);
    setEditingEpisode(episode.id);
    setEditForm({
      episodeNumber: String(episode.number),
      title: episode.title ?? "",
      duration: episode.duration ? String(episode.duration) : "",
      thumbnail: episode.thumbnail ?? "",
      airDate: episode.airDate ? episode.airDate.slice(0, 10) : "",
      introStart: episode.introStart !== null ? String(episode.introStart) : "",
      introEnd: episode.introEnd !== null ? String(episode.introEnd) : "",
      outroStart: episode.outroStart !== null ? String(episode.outroStart) : "",
    });
  };

  const saveEpisode = async (event: React.FormEvent, episodeId: string) => {
    event.preventDefault();
    const ok = await request(`/api/admin/episodes/${episodeId}`, "PUT", {
      animeId,
      episodeNumber: Number(editForm.episodeNumber),
      title: editForm.title || null,
      duration: editForm.duration ? Number(editForm.duration) : null,
      thumbnail: editForm.thumbnail || null,
      airDate: editForm.airDate || null,
      introStart: editForm.introStart ? Number(editForm.introStart) : null,
      introEnd: editForm.introEnd ? Number(editForm.introEnd) : null,
      outroStart: editForm.outroStart ? Number(editForm.outroStart) : null,
    });
    if (ok) setEditingEpisode(null);
  };

  const addSource = async (episodeId: string) => {
    const ok = await request("/api/admin/sources", "POST", {
      episodeId,
      provider: sourceForm.provider,
      url: sourceForm.url,
      quality: Number(sourceForm.quality),
      format: sourceForm.format,
      codec: sourceForm.codec || null,
      language: sourceForm.language,
      status: sourceForm.status,
      subtitleSupport: true,
      isActive: true,
    });
    if (ok) setSourceForm((current) => ({ ...current, url: "" }));
  };

  const addSubtitle = async (episodeId: string) => {
    const ok = await request("/api/admin/subtitles", "POST", {
      episodeId,
      language: subtitleForm.language,
      label: subtitleForm.label,
      url: subtitleForm.url,
      format: subtitleForm.format,
      isDefault: subtitleForm.isDefault,
      isActive: true,
      status: "ACTIVE",
    });
    if (ok) setSubtitleForm((current) => ({ ...current, url: "" }));
  };

  const validate = async (type: "sources" | "subtitles", id: string) => {
    await request("/api/admin/validate", "POST", { type, id, limit: 1 });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-bold text-white">Episode ({episodes.length})</h2>
        <button type="button" onClick={() => setShowAddEpisode((open) => !open)} className="btn-secondary px-3 py-1.5 text-xs">
          <Plus className="h-3.5 w-3.5" aria-hidden="true" /> Tambah episode
        </button>
      </div>

      {message && (
        <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200" role="status">
          {message}
        </p>
      )}

      {showAddEpisode && (
        <form onSubmit={addEpisode} className="surface space-y-3 p-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <label className="block">
              <span className="label">Nomor *</span>
              <input
                className="input"
                type="number"
                step={0.1}
                min={0}
                required
                value={episodeForm.episodeNumber}
                onChange={(event) => setEpisodeForm({ ...episodeForm, episodeNumber: event.target.value })}
              />
            </label>
            <label className="block sm:col-span-3">
              <span className="label">Judul</span>
              <input
                className="input"
                value={episodeForm.title}
                onChange={(event) => setEpisodeForm({ ...episodeForm, title: event.target.value })}
              />
            </label>
            <label className="block">
              <span className="label">Durasi (detik)</span>
              <input
                className="input"
                type="number"
                value={episodeForm.duration}
                onChange={(event) => setEpisodeForm({ ...episodeForm, duration: event.target.value })}
              />
            </label>
            <label className="block">
              <span className="label">Tanggal tayang</span>
              <input
                className="input"
                type="date"
                value={episodeForm.airDate}
                onChange={(event) => setEpisodeForm({ ...episodeForm, airDate: event.target.value })}
              />
            </label>
            <label className="block">
              <span className="label">Intro mulai</span>
              <input
                className="input"
                type="number"
                value={episodeForm.introStart}
                onChange={(event) => setEpisodeForm({ ...episodeForm, introStart: event.target.value })}
              />
            </label>
            <label className="block">
              <span className="label">Intro selesai</span>
              <input
                className="input"
                type="number"
                value={episodeForm.introEnd}
                onChange={(event) => setEpisodeForm({ ...episodeForm, introEnd: event.target.value })}
              />
            </label>
            <label className="block sm:col-span-2">
              <span className="label">Thumbnail</span>
              <input
                className="input"
                value={episodeForm.thumbnail}
                onChange={(event) => setEpisodeForm({ ...episodeForm, thumbnail: event.target.value })}
                placeholder="/art/... atau https://..."
              />
            </label>
            <label className="block sm:col-span-2">
              <span className="label">Outro mulai</span>
              <input
                className="input"
                type="number"
                value={episodeForm.outroStart}
                onChange={(event) => setEpisodeForm({ ...episodeForm, outroStart: event.target.value })}
              />
            </label>
          </div>
          <button type="submit" disabled={Boolean(busy)} className="btn-primary text-xs">
            {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />} Simpan episode
          </button>
        </form>
      )}

      {episodes.length === 0 ? (
        <div className="surface px-4 py-8 text-center text-xs text-white/40">
          Belum ada episode. Tambahkan episode setelah anime dibuat.
        </div>
      ) : (
        <ul className="space-y-2">
          {episodes.map((episode) => {
            const open = expanded === episode.id;
            return (
              <li key={episode.id} className="surface overflow-hidden">
                <div className="flex items-center gap-2 px-3 py-2.5">
                  <button
                    type="button"
                    onClick={() => setExpanded(open ? null : episode.id)}
                    className="flex min-w-0 flex-1 items-center gap-2 text-left"
                    aria-expanded={open}
                  >
                    {open ? (
                      <ChevronDown className="h-4 w-4 shrink-0 text-white/40" aria-hidden="true" />
                    ) : (
                      <ChevronRight className="h-4 w-4 shrink-0 text-white/40" aria-hidden="true" />
                    )}
                    <span className="shrink-0 rounded bg-white/[0.07] px-1.5 py-0.5 text-[11px] font-bold text-white/70">
                      EP {formatEpisodeNumber(episode.number)}
                    </span>
                    <span className="truncate text-sm text-white/85">{episode.title ?? "Tanpa judul"}</span>
                    <span className="ml-auto hidden shrink-0 items-center gap-2 text-[10px] text-white/35 sm:flex">
                      <span className="inline-flex items-center gap-1">
                        <Video className="h-3 w-3" aria-hidden="true" /> {episode.sources.length}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Subtitles className="h-3 w-3" aria-hidden="true" /> {episode.subtitles.length}
                      </span>
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => (editingEpisode === episode.id ? setEditingEpisode(null) : startEdit(episode))}
                    className="rounded-md px-2 py-1.5 text-[11px] font-medium text-accent hover:bg-accent/10"
                  >
                    {editingEpisode === episode.id ? "Batal" : "Edit"}
                  </button>
                  <DeleteButton
                    endpoint={`/api/admin/episodes/${episode.id}`}
                    confirmMessage={`Hapus episode ${formatEpisodeNumber(episode.number)}? Sumber dan subtitle ikut terhapus.`}
                    label=""
                  />
                </div>

                {open && editingEpisode === episode.id && (
                  <form
                    onSubmit={(event) => saveEpisode(event, episode.id)}
                    className="space-y-3 border-t border-white/[0.07] bg-white/[0.02] px-3 py-3"
                  >
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      <label className="block">
                        <span className="label">Nomor *</span>
                        <input
                          className="input py-1.5 text-xs"
                          type="number"
                          step={0.1}
                          min={0}
                          required
                          value={editForm.episodeNumber}
                          onChange={(event) => setEditForm({ ...editForm, episodeNumber: event.target.value })}
                        />
                      </label>
                      <label className="block sm:col-span-3">
                        <span className="label">Judul</span>
                        <input
                          className="input py-1.5 text-xs"
                          value={editForm.title}
                          onChange={(event) => setEditForm({ ...editForm, title: event.target.value })}
                        />
                      </label>
                      <label className="block">
                        <span className="label">Durasi (detik)</span>
                        <input
                          className="input py-1.5 text-xs"
                          type="number"
                          value={editForm.duration}
                          onChange={(event) => setEditForm({ ...editForm, duration: event.target.value })}
                        />
                      </label>
                      <label className="block">
                        <span className="label">Tanggal tayang</span>
                        <input
                          className="input py-1.5 text-xs"
                          type="date"
                          value={editForm.airDate}
                          onChange={(event) => setEditForm({ ...editForm, airDate: event.target.value })}
                        />
                      </label>
                      <label className="block">
                        <span className="label">Intro mulai</span>
                        <input
                          className="input py-1.5 text-xs"
                          type="number"
                          value={editForm.introStart}
                          onChange={(event) => setEditForm({ ...editForm, introStart: event.target.value })}
                        />
                      </label>
                      <label className="block">
                        <span className="label">Intro selesai</span>
                        <input
                          className="input py-1.5 text-xs"
                          type="number"
                          value={editForm.introEnd}
                          onChange={(event) => setEditForm({ ...editForm, introEnd: event.target.value })}
                        />
                      </label>
                      <label className="block sm:col-span-2">
                        <span className="label">Thumbnail</span>
                        <input
                          className="input py-1.5 text-xs"
                          value={editForm.thumbnail}
                          onChange={(event) => setEditForm({ ...editForm, thumbnail: event.target.value })}
                        />
                      </label>
                      <label className="block">
                        <span className="label">Outro mulai</span>
                        <input
                          className="input py-1.5 text-xs"
                          type="number"
                          value={editForm.outroStart}
                          onChange={(event) => setEditForm({ ...editForm, outroStart: event.target.value })}
                        />
                      </label>
                    </div>
                    <button type="submit" disabled={Boolean(busy)} className="btn-primary text-xs">
                      {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />} Simpan perubahan
                    </button>
                  </form>
                )}

                {open && (
                  <div className="space-y-4 border-t border-white/[0.07] px-3 py-3">
                    <div>
                      <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-white/45">
                        <Video className="h-3.5 w-3.5" aria-hidden="true" /> Sumber video
                      </h3>
                      {episode.sources.length === 0 ? (
                        <p className="text-xs text-white/35">Belum ada sumber.</p>
                      ) : (
                        <ul className="space-y-1.5">
                          {episode.sources.map((source) => (
                            <li key={source.id} className="flex items-center gap-2 rounded-md bg-white/[0.03] px-2 py-1.5">
                              <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${statusColor[source.status] ?? ""}`}>
                                {source.status}
                              </span>
                              <span className="shrink-0 text-[11px] font-semibold text-white/70">
                                {source.quality > 0 ? `${source.quality}p` : "Auto"} · {source.format}
                              </span>
                              <span className="truncate text-[11px] text-white/35">{source.url}</span>
                              <div className="ml-auto flex shrink-0 items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => validate("sources", source.id)}
                                  disabled={Boolean(busy)}
                                  className="rounded p-1 text-white/40 hover:bg-white/10 hover:text-emerald-300"
                                  aria-label="Validasi sumber"
                                  title="Validasi sumber"
                                >
                                  <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                                </button>
                                <DeleteButton
                                  endpoint={`/api/admin/sources/${source.id}`}
                                  confirmMessage="Hapus sumber video ini?"
                                  label=""
                                />
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}

                      <div className="mt-2 grid gap-2 sm:grid-cols-4">
                        <input
                          className="input py-1.5 text-xs sm:col-span-2"
                          placeholder="URL HLS/MP4 resmi"
                          value={sourceForm.url}
                          onChange={(event) => setSourceForm({ ...sourceForm, url: event.target.value })}
                          aria-label="URL sumber video"
                        />
                        <select
                          className="input py-1.5 text-xs"
                          value={sourceForm.quality}
                          onChange={(event) => setSourceForm({ ...sourceForm, quality: event.target.value })}
                          aria-label="Kualitas"
                        >
                          <option value="0">Auto</option>
                          <option value="360">360p</option>
                          <option value="480">480p</option>
                          <option value="720">720p</option>
                          <option value="1080">1080p</option>
                        </select>
                        <button
                          type="button"
                          onClick={() => addSource(episode.id)}
                          disabled={Boolean(busy) || !sourceForm.url}
                          className="btn-secondary py-1.5 text-xs"
                        >
                          <Plus className="h-3.5 w-3.5" aria-hidden="true" /> Sumber
                        </button>
                      </div>
                    </div>

                    <div>
                      <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-white/45">
                        <Subtitles className="h-3.5 w-3.5" aria-hidden="true" /> Subtitle
                      </h3>
                      {episode.subtitles.length === 0 ? (
                        <p className="text-xs text-white/35">Belum ada subtitle.</p>
                      ) : (
                        <ul className="space-y-1.5">
                          {episode.subtitles.map((track) => (
                            <li key={track.id} className="flex items-center gap-2 rounded-md bg-white/[0.03] px-2 py-1.5">
                              <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${statusColor[track.status] ?? ""}`}>
                                {track.status}
                              </span>
                              <span className="shrink-0 text-[11px] font-semibold uppercase text-white/70">
                                {track.language}
                              </span>
                              <span className="truncate text-[11px] text-white/45">{track.label}</span>
                              {track.isDefault && (
                                <span className="rounded bg-accent/15 px-1 py-0.5 text-[9px] font-bold text-accent">
                                  DEFAULT
                                </span>
                              )}
                              <span className="truncate text-[10px] text-white/25">{track.url}</span>
                              <div className="ml-auto flex shrink-0 items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => validate("subtitles", track.id)}
                                  disabled={Boolean(busy)}
                                  className="rounded p-1 text-white/40 hover:bg-white/10 hover:text-emerald-300"
                                  aria-label="Validasi subtitle"
                                  title="Validasi subtitle"
                                >
                                  <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                                </button>
                                <DeleteButton
                                  endpoint={`/api/admin/subtitles/${track.id}`}
                                  confirmMessage="Hapus subtitle ini?"
                                  label=""
                                />
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}

                      <div className="mt-2 grid gap-2 sm:grid-cols-4">
                        <input
                          className="input py-1.5 text-xs sm:col-span-2"
                          placeholder="URL subtitle (VTT/SRT)"
                          value={subtitleForm.url}
                          onChange={(event) => setSubtitleForm({ ...subtitleForm, url: event.target.value })}
                          aria-label="URL subtitle"
                        />
                        <select
                          className="input py-1.5 text-xs"
                          value={subtitleForm.language}
                          onChange={(event) =>
                            setSubtitleForm({
                              ...subtitleForm,
                              language: event.target.value,
                              label:
                                event.target.value === "id"
                                  ? "Bahasa Indonesia"
                                  : event.target.value === "en"
                                    ? "English"
                                    : "日本語",
                            })
                          }
                          aria-label="Bahasa subtitle"
                        >
                          <option value="id">Indonesia</option>
                          <option value="en">English</option>
                          <option value="ja">Japanese</option>
                        </select>
                        <button
                          type="button"
                          onClick={() => addSubtitle(episode.id)}
                          disabled={Boolean(busy) || !subtitleForm.url}
                          className="btn-secondary py-1.5 text-xs"
                        >
                          <Plus className="h-3.5 w-3.5" aria-hidden="true" /> Subtitle
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
