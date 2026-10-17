"use client";

import { Captions, Check, Gauge, SlidersHorizontal, X } from "lucide-react";
import type { PlayerSubtitle, SubtitleStyle } from "./types";
import { PLAYBACK_RATES } from "./utils";

export interface SettingsMenuProps {
  open: boolean;
  onClose: () => void;
  qualityOptions: Array<{ value: number; label: string }>;
  selectedQuality: number;
  onQualityChange: (value: number) => void;
  playbackRate: number;
  onPlaybackRateChange: (value: number) => void;
  subtitles: PlayerSubtitle[];
  subtitleId: string | null;
  onSubtitleChange: (id: string | null) => void;
  subtitleStyle: SubtitleStyle;
  onSubtitleStyleChange: (style: SubtitleStyle) => void;
  autoNext: boolean;
  onAutoNextChange: (value: boolean) => void;
  subtitleError?: string | null;
}

function SectionTitle({
  icon,
  children,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-white/60">
      {icon}
      {children}
    </h3>
  );
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-3 rounded-lg px-2 py-2 text-left text-sm text-white/90 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff3b5c]"
    >
      <span>{label}</span>
      <span
        className={`relative h-5 w-9 rounded-full transition-colors ${checked ? "bg-[#ff3b5c]" : "bg-white/25"}`}
        aria-hidden="true"
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${checked ? "translate-x-4" : "translate-x-0.5"}`}
        />
      </span>
    </button>
  );
}

function RangeSetting({
  label,
  value,
  min,
  max,
  step,
  suffix,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  suffix: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="flex items-center justify-between text-xs text-white/70">
        <span>{label}</span>
        <span className="font-mono text-white/90">
          {Math.round(value * 100) / 100}
          {suffix}
        </span>
      </span>
      <input
        type="range"
        className="anp-range w-full"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        aria-label={label}
      />
    </label>
  );
}

export function SettingsMenu({
  open,
  onClose,
  qualityOptions,
  selectedQuality,
  onQualityChange,
  playbackRate,
  onPlaybackRateChange,
  subtitles,
  subtitleId,
  onSubtitleChange,
  subtitleStyle,
  onSubtitleStyleChange,
  autoNext,
  onAutoNextChange,
  subtitleError,
}: SettingsMenuProps) {
  if (!open) return null;

  return (
    <>
      <div className="absolute inset-0 z-30" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-label="Pengaturan pemutar"
        className="absolute bottom-16 right-2 z-40 w-[min(92vw,360px)] overflow-hidden rounded-xl border border-white/10 bg-[#141418]/95 text-white shadow-2xl backdrop-blur-md sm:right-4"
      >
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <span className="flex items-center gap-2 text-sm font-semibold">
            <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
            Pengaturan
          </span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-white/70 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff3b5c]"
            aria-label="Tutup pengaturan"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="max-h-[58vh] space-y-5 overflow-y-auto p-4">
          {qualityOptions.length > 1 && (
            <section className="space-y-2">
              <SectionTitle icon={<Gauge className="h-3.5 w-3.5" aria-hidden="true" />}>Kualitas</SectionTitle>
              <div className="grid grid-cols-3 gap-1.5">
                <button
                  type="button"
                  onClick={() => onQualityChange(-1)}
                  className={`rounded-md px-2 py-2 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff3b5c] ${
                    selectedQuality === -1 ? "bg-[#ff3b5c] text-white" : "bg-white/8 text-white/75 hover:bg-white/15"
                  }`}
                  aria-pressed={selectedQuality === -1}
                >
                  Auto
                </button>
                {qualityOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => onQualityChange(option.value)}
                    className={`rounded-md px-2 py-2 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff3b5c] ${
                      selectedQuality === option.value
                        ? "bg-[#ff3b5c] text-white"
                        : "bg-white/8 text-white/75 hover:bg-white/15"
                    }`}
                    aria-pressed={selectedQuality === option.value}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <p className="text-[11px] leading-snug text-white/45">
                Kualitas yang tidak disediakan sumber tidak ditampilkan. Video tidak pernah di-upscale.
              </p>
            </section>
          )}

          <section className="space-y-2">
            <SectionTitle icon={<Gauge className="h-3.5 w-3.5" aria-hidden="true" />}>Kecepatan</SectionTitle>
            <div className="grid grid-cols-4 gap-1.5">
              {PLAYBACK_RATES.map((rate) => (
                <button
                  key={rate}
                  type="button"
                  onClick={() => onPlaybackRateChange(rate)}
                  className={`rounded-md px-2 py-2 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff3b5c] ${
                    playbackRate === rate ? "bg-[#ff3b5c] text-white" : "bg-white/8 text-white/75 hover:bg-white/15"
                  }`}
                  aria-pressed={playbackRate === rate}
                >
                  {rate === 1 ? "Normal" : `${rate}×`}
                </button>
              ))}
            </div>
          </section>

          <section className="space-y-2">
            <SectionTitle icon={<Captions className="h-3.5 w-3.5" aria-hidden="true" />}>Subtitle</SectionTitle>
            <div className="space-y-1">
              <button
                type="button"
                onClick={() => onSubtitleChange(null)}
                className="flex w-full items-center justify-between rounded-md px-2 py-2 text-left text-sm text-white/80 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff3b5c]"
                aria-pressed={subtitleId === null}
              >
                <span>Nonaktif</span>
                {subtitleId === null && <Check className="h-4 w-4 text-[#ff3b5c]" aria-hidden="true" />}
              </button>
              {subtitles.map((track) => (
                <button
                  key={track.id}
                  type="button"
                  onClick={() => onSubtitleChange(track.id)}
                  className="flex w-full items-center justify-between rounded-md px-2 py-2 text-left text-sm text-white/80 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff3b5c]"
                  aria-pressed={subtitleId === track.id}
                >
                  <span className="flex items-center gap-2">
                    {track.label}
                    <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-white/50">
                      {track.language}
                    </span>
                  </span>
                  {subtitleId === track.id && <Check className="h-4 w-4 text-[#ff3b5c]" aria-hidden="true" />}
                </button>
              ))}
              {!subtitles.length && <p className="px-2 text-xs text-white/45">Subtitle tidak tersedia.</p>}
              {subtitleError && <p className="px-2 text-xs text-amber-300">{subtitleError}</p>}
            </div>
          </section>

          {subtitles.length > 0 && (
            <section className="space-y-3">
              <SectionTitle icon={<Captions className="h-3.5 w-3.5" aria-hidden="true" />}>
                Tampilan Subtitle
              </SectionTitle>
              <RangeSetting
                label="Ukuran font"
                value={subtitleStyle.fontSize}
                min={12}
                max={40}
                step={1}
                suffix="px"
                onChange={(value) => onSubtitleStyleChange({ ...subtitleStyle, fontSize: value })}
              />
              <RangeSetting
                label="Posisi vertikal"
                value={subtitleStyle.bottom}
                min={4}
                max={40}
                step={1}
                suffix="%"
                onChange={(value) => onSubtitleStyleChange({ ...subtitleStyle, bottom: value })}
              />
              <RangeSetting
                label="Latar belakang"
                value={subtitleStyle.backgroundOpacity}
                min={0}
                max={1}
                step={0.05}
                suffix=""
                onChange={(value) => onSubtitleStyleChange({ ...subtitleStyle, backgroundOpacity: value })}
              />
              <RangeSetting
                label="Opasitas teks"
                value={subtitleStyle.textOpacity}
                min={0.3}
                max={1}
                step={0.05}
                suffix=""
                onChange={(value) => onSubtitleStyleChange({ ...subtitleStyle, textOpacity: value })}
              />
            </section>
          )}

          <section className="space-y-1 border-t border-white/10 pt-3">
            <Toggle checked={autoNext} onChange={onAutoNextChange} label="Putar episode berikutnya otomatis" />
          </section>
        </div>
      </div>
    </>
  );
}
