/**
 * Serializes structured data for inline <script type="application/ld+json">.
 * Escaping `<`, `>` and `&` prevents provider-supplied synopses/titles from
 * closing the script tag and injecting markup.
 */
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}
