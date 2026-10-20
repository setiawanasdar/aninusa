"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
  RefreshCw,
  Settings2,
} from "lucide-react";
import type { ChapterDetail, MangaChapterItem } from "@aninusa/types";

interface MangaReaderProps {
  chapter: ChapterDetail;
  chaptersList?: MangaChapterItem[];
  comicThumbnail?: string | null;
}

export function MangaReader({ chapter, chaptersList = [], comicThumbnail }: MangaReaderProps) {
  const router = useRouter();
  const readerContainerRef = useRef<HTMLDivElement>(null);

  // Reader state
  const [mode, setMode] = useState<"webtoon" | "paged">("webtoon");
  const [widthMode, setWidthMode] = useState<"md" | "lg" | "full">("md");
  const [currentPage, setCurrentPage] = useState(1);
  const [fullscreen, setFullscreen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [failedImages, setFailedImages] = useState<Record<number, boolean>>({});

  const totalImages = chapter.images.length;
  const comicSlug = chapter.comic.slug;

  // Auto-record reading history with debounce
  useEffect(() => {
    if (!comicSlug || !chapter.chapterSlug) return;

    const timer = setTimeout(() => {
      fetch("/api/manga/history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          comicSlug,
          comicTitle: chapter.comic.title || "Komik",
          thumbnail: comicThumbnail,
          lastChapterSlug: chapter.chapterSlug,
          lastChapterTitle: chapter.title,
          lastPage: currentPage,
        }),
      }).catch(() => {
        // Silently catch if unauthenticated or offline
      });
    }, 1200);

    return () => clearTimeout(timer);
  }, [comicSlug, chapter.comic.title, chapter.chapterSlug, chapter.title, currentPage, comicThumbnail]);

  // Sync title and listen for keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if user is typing in an input
      if (["INPUT", "TEXTAREA", "SELECT"].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

      if (mode === "paged") {
        if (e.key === "ArrowRight" || e.key === "ArrowDown" || e.key === " ") {
          e.preventDefault();
          if (currentPage < totalImages) {
            setCurrentPage((p) => p + 1);
            window.scrollTo({ top: 0, behavior: "smooth" });
          } else if (chapter.navigation.nextChapter) {
            router.push(`/manga/read/${chapter.navigation.nextChapter}?comic=${comicSlug}`);
          }
        } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
          e.preventDefault();
          if (currentPage > 1) {
            setCurrentPage((p) => p - 1);
            window.scrollTo({ top: 0, behavior: "smooth" });
          } else if (chapter.navigation.prevChapter) {
            router.push(`/manga/read/${chapter.navigation.prevChapter}?comic=${comicSlug}`);
          }
        }
      } else {
        // Webtoon mode chapter shortcuts
        if ((e.ctrlKey || e.metaKey) && e.key === "ArrowRight" && chapter.navigation.nextChapter) {
          router.push(`/manga/read/${chapter.navigation.nextChapter}?comic=${comicSlug}`);
        } else if ((e.ctrlKey || e.metaKey) && e.key === "ArrowLeft" && chapter.navigation.prevChapter) {
          router.push(`/manga/read/${chapter.navigation.prevChapter}?comic=${comicSlug}`);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [mode, currentPage, totalImages, chapter.navigation, comicSlug, router]);

  // Track active page while scrolling in webtoon mode
  useEffect(() => {
    if (mode !== "webtoon") return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const pageNum = parseInt(entry.target.getAttribute("data-page") || "1", 10);
            if (!Number.isNaN(pageNum)) {
              setCurrentPage(pageNum);
            }
          }
        }
      },
      { rootMargin: "-40% 0px -40% 0px" },
    );

    const elements = document.querySelectorAll("[data-page]");
    elements.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, [mode, chapter.images]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      readerContainerRef.current?.requestFullscreen?.().catch(() => {});
      setFullscreen(true);
    } else {
      document.exitFullscreen?.().catch(() => {});
      setFullscreen(false);
    }
  };

  const handleRetryImage = (page: number) => {
    setFailedImages((prev) => {
      const copy = { ...prev };
      delete copy[page];
      return copy;
    });
  };

  const maxWidthClass =
    widthMode === "md"
      ? "max-w-3xl"
      : widthMode === "lg"
        ? "max-w-5xl"
        : "max-w-full";

  return (
    <div
      ref={readerContainerRef}
      className={`min-h-screen bg-[#070709] text-white flex flex-col ${
        fullscreen ? "p-0" : ""
      }`}
    >
      {/* Reader Control Header */}
      <header className="sticky top-0 z-40 border-b border-white/10 bg-ink-950/90 backdrop-blur-md px-3 sm:px-6 py-2.5">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 sm:gap-4">
          {/* Back & Comic title */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <Link
              href={comicSlug ? `/manga/${comicSlug}` : "/manga"}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-ink-900 text-white/80 hover:bg-ink-800 hover:text-white"
              title="Kembali ke detail komik"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div className="truncate">
              <h1 className="text-xs sm:text-sm font-bold text-white truncate">
                {chapter.title}
              </h1>
              {chapter.comic.title && (
                <Link
                  href={comicSlug ? `/manga/${comicSlug}` : "/manga"}
                  className="text-[11px] text-accent hover:underline block truncate"
                >
                  {chapter.comic.title}
                </Link>
              )}
            </div>
          </div>

          {/* Center: Chapter Selector & Navigation */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {chapter.navigation.prevChapter ? (
              <Link
                href={`/manga/read/${chapter.navigation.prevChapter}?comic=${comicSlug}`}
                className="flex h-8 items-center gap-1 rounded-lg border border-white/10 bg-ink-900 px-2 sm:px-2.5 text-xs font-medium text-white/80 hover:bg-ink-800 hover:text-white"
                title="Chapter Sebelumnya"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                <span className="hidden md:inline">Sebelumnya</span>
              </Link>
            ) : (
              <span className="flex h-8 items-center gap-1 rounded-lg border border-white/5 bg-ink-950 px-2 sm:px-2.5 text-xs text-white/20 cursor-not-allowed">
                <ChevronLeft className="h-3.5 w-3.5" />
                <span className="hidden md:inline">Sebelumnya</span>
              </span>
            )}

            {/* Quick Chapter Selector */}
            {chaptersList.length > 0 && (
              <select
                aria-label="Pilih chapter"
                value={chapter.chapterSlug}
                onChange={(e) => {
                  const targetSlug = e.target.value;
                  if (targetSlug && targetSlug !== chapter.chapterSlug) {
                    router.push(`/manga/read/${targetSlug}?comic=${comicSlug}`);
                  }
                }}
                className="h-8 rounded-lg border border-white/10 bg-ink-900 px-2 text-xs font-semibold text-white focus:border-accent focus:outline-none max-w-[130px] sm:max-w-[200px]"
              >
                {chaptersList.map((ch) => (
                  <option key={ch.chapterSlug} value={ch.chapterSlug}>
                    {ch.title}
                  </option>
                ))}
              </select>
            )}

            {chapter.navigation.nextChapter ? (
              <Link
                href={`/manga/read/${chapter.navigation.nextChapter}?comic=${comicSlug}`}
                className="flex h-8 items-center gap-1 rounded-lg border border-accent/40 bg-accent/20 px-2 sm:px-2.5 text-xs font-medium text-accent hover:bg-accent/30"
                title="Chapter Berikutnya"
              >
                <span className="hidden md:inline">Berikutnya</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            ) : (
              <span className="flex h-8 items-center gap-1 rounded-lg border border-white/5 bg-ink-950 px-2 sm:px-2.5 text-xs text-white/20 cursor-not-allowed">
                <span className="hidden md:inline">Berikutnya</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </span>
            )}
          </div>

          {/* Right: Settings and Fullscreen */}
          <div className="flex items-center gap-1.5 relative">
            <button
              type="button"
              onClick={() => setShowSettings(!showSettings)}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-ink-900 text-white/80 hover:bg-ink-800 hover:text-white"
              title="Pengaturan Tampilan"
              aria-label="Pengaturan tampilan"
            >
              <Settings2 className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={toggleFullscreen}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-ink-900 text-white/80 hover:bg-ink-800 hover:text-white"
              title={fullscreen ? "Keluar Layar Penuh" : "Layar Penuh"}
              aria-label={fullscreen ? "Keluar layar penuh" : "Layar penuh"}
            >
              {fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </button>

            {/* Settings Dropdown Popover */}
            {showSettings && (
              <div className="absolute right-0 top-10 z-50 w-64 rounded-xl border border-white/10 bg-ink-900 p-4 shadow-2xl">
                <h4 className="text-xs font-bold uppercase tracking-wider text-white/60 mb-3">
                  Pengaturan Reader
                </h4>

                {/* Mode Selector */}
                <div className="mb-3">
                  <label className="text-xs text-white/70 block mb-1.5 font-medium">
                    Mode Membaca
                  </label>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => setMode("webtoon")}
                      className={`rounded-lg py-1.5 text-xs font-semibold ${
                        mode === "webtoon"
                          ? "bg-accent text-white"
                          : "bg-ink-800 text-white/70 hover:bg-ink-750"
                      }`}
                    >
                      Webtoon / Strip
                    </button>
                    <button
                      type="button"
                      onClick={() => setMode("paged")}
                      className={`rounded-lg py-1.5 text-xs font-semibold ${
                        mode === "paged"
                          ? "bg-accent text-white"
                          : "bg-ink-800 text-white/70 hover:bg-ink-750"
                      }`}
                    >
                      Per Halaman
                    </button>
                  </div>
                </div>

                {/* Width Selector */}
                <div>
                  <label className="text-xs text-white/70 block mb-1.5 font-medium">
                    Lebar Tampilan
                  </label>
                  <div className="grid grid-cols-3 gap-1">
                    <button
                      type="button"
                      onClick={() => setWidthMode("md")}
                      className={`rounded-lg py-1.5 text-xs font-semibold ${
                        widthMode === "md"
                          ? "bg-accent text-white"
                          : "bg-ink-800 text-white/70 hover:bg-ink-750"
                      }`}
                    >
                      Normal
                    </button>
                    <button
                      type="button"
                      onClick={() => setWidthMode("lg")}
                      className={`rounded-lg py-1.5 text-xs font-semibold ${
                        widthMode === "lg"
                          ? "bg-accent text-white"
                          : "bg-ink-800 text-white/70 hover:bg-ink-750"
                      }`}
                    >
                      Lebar
                    </button>
                    <button
                      type="button"
                      onClick={() => setWidthMode("full")}
                      className={`rounded-lg py-1.5 text-xs font-semibold ${
                        widthMode === "full"
                          ? "bg-accent text-white"
                          : "bg-ink-800 text-white/70 hover:bg-ink-750"
                      }`}
                    >
                      Penuh
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Reading Canvas */}
      <main className="flex-1 flex flex-col items-center justify-start py-4 sm:py-6 px-1 sm:px-4">
        {mode === "webtoon" ? (
          /* Webtoon / Continuous Vertical Strip */
          <div className={`w-full ${maxWidthClass} flex flex-col items-center space-y-0 shadow-2xl`}>
            {chapter.images.map((img) => (
              <div
                key={img.page}
                data-page={img.page}
                className="relative w-full flex flex-col items-center bg-[#070709]"
              >
                {failedImages[img.page] ? (
                  <div className="flex flex-col items-center justify-center p-8 border border-white/10 rounded-xl my-4 bg-ink-900 text-center w-full max-w-md">
                    <p className="text-xs text-white/60 mb-2">
                      Gagal memuat halaman {img.page}
                    </p>
                    <button
                      type="button"
                      onClick={() => handleRetryImage(img.page)}
                      className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white hover:bg-accent/80"
                    >
                      <RefreshCw className="h-3 w-3" />
                      Coba Muat Ulang
                    </button>
                  </div>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={img.url}
                    alt={img.alt || `Halaman ${img.page}`}
                    loading="lazy"
                    onError={() => {
                      setFailedImages((prev) => ({ ...prev, [img.page]: true }));
                    }}
                    className="w-full h-auto block select-none pointer-events-auto"
                  />
                )}
              </div>
            ))}
          </div>
        ) : (
          /* Single Page Mode */
          <div className={`w-full ${maxWidthClass} flex flex-col items-center`}>
            {chapter.images[currentPage - 1] && (
              <div
                className="relative w-full flex flex-col items-center cursor-pointer select-none"
                onClick={() => {
                  if (currentPage < totalImages) {
                    setCurrentPage((p) => p + 1);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }
                }}
              >
                {failedImages[currentPage] ? (
                  <div className="flex flex-col items-center justify-center p-12 border border-white/10 rounded-xl my-4 bg-ink-900 text-center w-full max-w-md">
                    <p className="text-xs text-white/60 mb-2">
                      Gagal memuat halaman {currentPage}
                    </p>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRetryImage(currentPage);
                      }}
                      className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white hover:bg-accent/80"
                    >
                      <RefreshCw className="h-3 w-3" />
                      Coba Muat Ulang
                    </button>
                  </div>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={chapter.images[currentPage - 1].url}
                    alt={chapter.images[currentPage - 1].alt || `Halaman ${currentPage}`}
                    onError={() => {
                      setFailedImages((prev) => ({ ...prev, [currentPage]: true }));
                    }}
                    className="w-full h-auto max-h-[88vh] object-contain block rounded-lg shadow-2xl"
                  />
                )}
              </div>
            )}

            {/* Paged mode page controller */}
            <div className="mt-4 flex items-center gap-3">
              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() => {
                  setCurrentPage((p) => Math.max(1, p - 1));
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                className="flex items-center gap-1 rounded-lg border border-white/10 bg-ink-900 px-3 py-2 text-xs font-semibold text-white hover:bg-ink-800 disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" />
                Sebelumnya
              </button>
              <span className="text-xs font-semibold text-white/80">
                Halaman {currentPage} dari {totalImages}
              </span>
              <button
                type="button"
                disabled={currentPage >= totalImages}
                onClick={() => {
                  setCurrentPage((p) => Math.min(totalImages, p + 1));
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                className="flex items-center gap-1 rounded-lg border border-white/10 bg-ink-900 px-3 py-2 text-xs font-semibold text-white hover:bg-ink-800 disabled:opacity-40"
              >
                Berikutnya
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* Floating Page Counter Pill for Webtoon mode */}
        {mode === "webtoon" && (
          <div className="fixed bottom-6 right-6 z-30 rounded-full border border-white/15 bg-black/80 px-3 py-1 text-xs font-bold text-white/90 backdrop-blur-md shadow-lg">
            {currentPage} / {totalImages}
          </div>
        )}

        {/* Bottom Chapter Navigation Bar */}
        <div className={`mt-8 w-full ${maxWidthClass} rounded-2xl border border-white/10 bg-ink-900/90 p-4 sm:p-6 backdrop-blur-md`}>
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            {chapter.navigation.prevChapter ? (
              <Link
                href={`/manga/read/${chapter.navigation.prevChapter}?comic=${comicSlug}`}
                className="flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl border border-white/10 bg-ink-850 px-4 py-2.5 text-xs font-semibold text-white hover:bg-ink-800 transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Chapter Sebelumnya</span>
              </Link>
            ) : (
              <span className="flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl border border-white/5 bg-ink-950 px-4 py-2.5 text-xs font-semibold text-white/30 cursor-not-allowed">
                <ArrowLeft className="h-4 w-4" />
                <span>Awal Chapter</span>
              </span>
            )}

            <Link
              href={comicSlug ? `/manga/${comicSlug}` : "/manga"}
              className="flex items-center gap-2 text-xs font-semibold text-accent hover:underline"
            >
              <BookOpen className="h-4 w-4" />
              <span>Daftar Semua Chapter</span>
            </Link>

            {chapter.navigation.nextChapter ? (
              <Link
                href={`/manga/read/${chapter.navigation.nextChapter}?comic=${comicSlug}`}
                className="flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl border border-accent/40 bg-accent px-4 py-2.5 text-xs font-semibold text-white hover:bg-accent/80 transition-colors shadow-lg shadow-accent/20"
              >
                <span>Chapter Berikutnya</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            ) : (
              <span className="flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl border border-white/5 bg-ink-950 px-4 py-2.5 text-xs font-semibold text-white/30 cursor-not-allowed">
                <span>Chapter Terakhir</span>
                <ArrowRight className="h-4 w-4" />
              </span>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
