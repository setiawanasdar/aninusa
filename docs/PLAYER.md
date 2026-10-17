# Media player

Package: `packages/player` (`@aninusa/player`). Built from scratch on the native `<video>` element and hls.js. No iframe embeds.

## Usage

```tsx
import { VideoPlayer } from "@aninusa/player";

<VideoPlayer
  sources={[
    { id: "auto", url: "https://…/master.m3u8", quality: 0, format: "HLS" },
    { id: "1080", url: "https://…/1080.mp4", quality: 1080, format: "MP4" },
  ]}
  subtitles={[
    { id: "id", language: "id", label: "Bahasa Indonesia", format: "VTT", url: "/subtitles/x-id.vtt", isDefault: true },
  ]}
  poster="/art/poster.svg"
  animeTitle="Sintel"
  animeHref="/anime/sintel"
  episodeNumber={1}
  episodeTitle="Sintel"
  startAt={120}
  intro={{ start: 0, end: 15 }}
  outroStart={850}
  previousEpisode={{ id: "ep_0", number: 0 }}
  nextEpisode={{ id: "ep_2", number: 2 }}
  onPreviousEpisode={() => router.push(prevHref)}
  onNextEpisode={() => router.push(nextHref)}
  onProgress={({ currentTime, duration, completed }) => save(currentTime, duration, completed)}
  theater={theater}
  onTheaterChange={setTheater}
/>
```

## Props

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `sources` | `PlayerSource[]` | required | `quality: 0` means adaptive master playlist |
| `subtitles` | `PlayerSubtitle[]` | `[]` | VTT/SRT; Indonesian auto-selected |
| `poster` | `string \| null` | — | Shown before playback |
| `animeTitle` / `animeHref` | string | — | Top overlay |
| `episodeNumber` / `episodeTitle` | number / string | — | Top overlay |
| `startAt` | number | `0` | Resume position in seconds |
| `autoPlay` | boolean | `false` | Browsers may block unmuted autoplay |
| `autoNextDefault` | boolean | `true` | Initial state of the auto-next switch |
| `nextEpisode` / `previousEpisode` | `{ id, number }` | — | Enables N/P shortcuts and buttons |
| `onNextEpisode` / `onPreviousEpisode` | `() => void` | — | Navigation is owned by the app |
| `onBack` | `() => void` | — | Optional back link in the overlay |
| `intro` | `{ start, end }` | — | Enables “Lewati intro” |
| `outroStart` | number | — | Enables “Lewati outro” / next-episode prompt |
| `theater` | boolean | `false` | Controlled theater mode |
| `onTheaterChange` | `(enabled) => void` | — | Required for the theater button |
| `onProgress` | `(progress) => void` | — | Throttled to 5s, forced on pause/end/unload |
| `onEnded` | `() => void` | — | Fired before auto-next navigation |

## Keyboard shortcuts

| Key | Action |
| --- | --- |
| `Space` / `K` | Play / pause |
| `←` / `→` | Seek −10s / +10s (`Shift` = 30s) |
| `↑` / `↓` | Volume ±10% |
| `M` | Mute |
| `F` | Fullscreen |
| `N` | Next episode (if available) |
| `P` | Previous episode (if available) |
| `T` | Theater mode |
| `I` | Picture-in-picture |
| `C` | Open settings (captions/quality/speed) |
| `Home` / `End` | Seek to start/end (progress bar focused) |

Shortcuts are ignored while typing in inputs, textareas, selects, or contenteditable elements.

## Quality selection

- **HLS:** levels are read from the manifest (`MANIFEST_PARSED`). Options show only heights that exist, deduplicated and sorted descending. `Auto` uses hls.js adaptive switching (`currentLevel = -1`); manual selection pins a level.
- **DASH:** dash.js is loaded on demand (`import("dashjs")`) only for DASH sources, so HLS/MP4 users never pay for it. Bitrate heights populate the same quality menu; `Auto` re-enables ABR.
- **Progressive:** each `quality` value becomes an option; switching preserves playback position and play state.
- **No upscaling:** the player never offers a resolution the source does not provide. A 720p-only source shows `720p` and `Auto`, not `1080p`.

`pickAutoQuality()` (exported for tests) chooses the highest rendition at or below an estimated bandwidth target and falls back to the lowest available.

## Subtitles

Subtitles are fetched and parsed client-side (`parseSubtitles` from `@aninusa/utils`), then rendered as an overlay. This is what enables:

- Enable/disable (Nonaktif).
- Language selection (Indonesian, English, Japanese).
- Font size 12–40px.
- Vertical position 4–40% from the bottom.
- Background opacity 0–1.
- Text opacity 0.3–1.

Defaults: Indonesian track when available, font 20px, bottom 10%, background 0.65. Preferences persist in `localStorage` under `aninusa:player:*`.

If the Indonesian track fails to load, the player shows “Subtitle Indonesia tidak tersedia.” and keeps playback running. ASS/SSA is rejected with `UnsupportedSubtitleFormatError`; convert to VTT server-side.

## Playback features

- Play/pause, seek bar with buffered range and hover time preview.
- Volume slider (expands on hover) and mute.
- Current time / duration.
- Fullscreen and picture-in-picture (with feature detection).
- Theater mode (controlled by the watch page).
- Playback speed: 0.5×, 0.75×, 1×, 1.25×, 1.5×, 1.75×, 2×.
- Auto-next episode (persisted preference).
- Skip intro / outro buttons.
- Resume from saved progress.
- Loading spinner, error state with “Coba sumber lain” (cycles sources), end screen with replay/next.
- Accessible labels, focus rings, `aria-pressed`/`aria-valuenow`, and reduced-motion CSS.

## Error recovery

| Situation | Behavior |
| --- | --- |
| HLS network error (fatal) | `hls.startLoad()` |
| HLS media error (fatal) | `hls.recoverMediaError()` |
| Other fatal HLS error | Error overlay + retry |
| Native video error | Error overlay + retry |
| No sources | “Sumber video tidak tersedia.” panel |
| Subtitle fetch/parse failure | Non-blocking warning |

Technical details are logged to the browser console only in development; the UI never shows stack traces.

## Integration notes

- The player is a client component (`"use client"` barrel). Import it only from client components.
- `onProgress` should be idempotent; the watch page posts to `/api/watch-progress` with `keepalive`.
- For guests, the watch page stores progress in `localStorage` and offers a login link to sync.
- `theater` is controlled so the watch page can rearrange the episode sidebar.
