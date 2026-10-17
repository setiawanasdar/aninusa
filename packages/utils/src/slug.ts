/**
 * SEO-friendly slug generation. Keeps Latin characters, transliterates common
 * diacritics, and falls back to "anime" when a title has no Latin characters.
 * Callers should prefer the English title before the native title when possible.
 */
export function slugify(input: string): string {
  const slug = input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/['’`]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90)
    .replace(/-+$/g, "");

  return slug || "anime";
}

export function makeUniqueSlug(base: string, taken: ReadonlySet<string>): string {
  const normalized = slugify(base);
  if (!taken.has(normalized)) return normalized;

  for (let index = 2; index < 10_000; index += 1) {
    const candidate = `${normalized}-${index}`;
    if (!taken.has(candidate)) return candidate;
  }

  return `${normalized}-${Date.now()}`;
}

export function isValidSlug(value: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}
