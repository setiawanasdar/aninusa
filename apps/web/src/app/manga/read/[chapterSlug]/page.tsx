import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MangaReader } from "@/components/manga/manga-reader";
import { getChapterDetail, getMangaDetail } from "@/lib/manga";

export const dynamic = "force-dynamic";

interface MangaReaderPageProps {
  params: Promise<{ chapterSlug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({
  params,
  searchParams,
}: MangaReaderPageProps): Promise<Metadata> {
  const { chapterSlug } = await params;
  const rawParams = await searchParams;
  const comicSlug = typeof rawParams.comic === "string" ? rawParams.comic : undefined;

  const chapter = await getChapterDetail(chapterSlug, comicSlug);

  if (!chapter) {
    return { title: "Chapter Tidak Ditemukan" };
  }

  const comicTitle = chapter.comic.title ? ` - ${chapter.comic.title}` : "";
  return {
    title: `Baca ${chapter.title}${comicTitle} Bahasa Indonesia`,
    description: `Baca ${chapter.title}${comicTitle} dengan gambar berkualitas tinggi online di AniNusa.`,
    robots: { index: false, follow: true },
  };
}

export default async function MangaReaderPage({
  params,
  searchParams,
}: MangaReaderPageProps) {
  const { chapterSlug } = await params;
  const rawParams = await searchParams;
  const comicSlug = typeof rawParams.comic === "string" ? rawParams.comic : undefined;

  const chapter = await getChapterDetail(chapterSlug, comicSlug);

  if (!chapter) {
    notFound();
  }

  // Load all chapters for the dropdown selector
  const resolvedComicSlug = chapter.comic.slug || comicSlug;
  let chaptersList: any[] = [];
  let comicThumbnail: string | undefined;
  if (resolvedComicSlug) {
    const comic = await getMangaDetail(resolvedComicSlug);
    if (comic) {
      chaptersList = comic.chapters;
      comicThumbnail = comic.thumbnail;
    }
  }

  return (
    <MangaReader
      chapter={chapter}
      chaptersList={chaptersList}
      comicThumbnail={comicThumbnail}
    />
  );
}
