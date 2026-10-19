import type { Metadata } from "next";
import { MangaFooter } from "@/components/manga/manga-footer";
import { siteName } from "@/lib/env";

export const metadata: Metadata = {
  title: {
    default: `Manga & Komik — ${siteName()}`,
    template: `%s · Manga ${siteName()}`,
  },
  description:
    "Baca manga, manhwa, dan manhua dengan terjemahan Bahasa Indonesia. Update chapter tercepat dan gambar kualitas tinggi.",
};

export default function MangaLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <MangaFooter />
    </>
  );
}
