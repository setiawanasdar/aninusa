import { cache } from "./cache";

export interface VttCue {
  id?: string;
  timeRange: string;
  lines: string[];
}

export function parseVtt(content: string): { header: string; cues: VttCue[] } {
  const normalized = content.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = normalized.split("\n");

  let header = "WEBVTT\n\n";
  const cues: VttCue[] = [];

  let i = 0;
  // Read header
  if (lines[0]?.startsWith("WEBVTT")) {
    const headerLines: string[] = [];
    while (i < lines.length && lines[i]!.trim() !== "" && !lines[i]!.includes("-->")) {
      headerLines.push(lines[i]!);
      i++;
    }
    header = headerLines.join("\n") + "\n\n";
  }

  // Read cues
  while (i < lines.length) {
    const line = lines[i]!.trim();
    if (!line) {
      i++;
      continue;
    }

    let cueId: string | undefined;
    let timeRange = "";

    if (line.includes("-->")) {
      timeRange = line;
      i++;
    } else if (i + 1 < lines.length && lines[i + 1]!.includes("-->")) {
      cueId = line;
      timeRange = lines[i + 1]!.trim();
      i += 2;
    } else {
      i++;
      continue;
    }

    const cueLines: string[] = [];
    while (i < lines.length && lines[i]!.trim() !== "") {
      cueLines.push(lines[i]!);
      i++;
    }

    if (timeRange && cueLines.length > 0) {
      cues.push({ id: cueId, timeRange, lines: cueLines });
    }
  }

  return { header, cues };
}

export function serializeVtt(header: string, cues: VttCue[]): string {
  let result = header.trim() + "\n\n";
  for (const cue of cues) {
    if (cue.id) result += `${cue.id}\n`;
    result += `${cue.timeRange}\n`;
    result += `${cue.lines.join("\n")}\n\n`;
  }
  return result;
}

async function translateBatch(texts: string[], targetLang = "id"): Promise<string[]> {
  if (texts.length === 0) return [];
  const joined = texts.map((t) => t.replace(/\n/g, " <br> ")).join("\n---\n");
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(
    joined,
  )}`;

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
      },
    });
    const data = await res.json();
    if (!Array.isArray(data?.[0])) return texts;
    const rawTranslated: string = data[0]
      .map((item: any) => (Array.isArray(item) ? item[0] : ""))
      .join("");

    const items = rawTranslated.split(/\s*---\s*/);
    return items.map((item) => item.replace(/\s*<br>\s*/gi, "\n").trim());
  } catch (error) {
    console.error("Batch translation failed, returning original texts:", error);
    return texts;
  }
}

/**
 * Translates raw VTT text to target language in chunks of 30 cues.
 */
export async function translateVttText(rawVtt: string, targetLang = "id"): Promise<string> {
  const { header, cues } = parseVtt(rawVtt);
  if (cues.length === 0) return rawVtt;

  const CHUNK_SIZE = 30;
  for (let i = 0; i < cues.length; i += CHUNK_SIZE) {
    const chunk = cues.slice(i, i + CHUNK_SIZE);
    const texts = chunk.map((c) => c.lines.join(" "));
    const translated = await translateBatch(texts, targetLang);

    for (let j = 0; j < chunk.length; j++) {
      if (translated[j]) {
        chunk[j]!.lines = [translated[j]!];
      }
    }
  }

  return serializeVtt(header, cues);
}

/**
 * Fetches an external VTT subtitle, translates it on-the-fly, and caches the result.
 */
export async function translateVttFromUrl(
  sourceUrl: string,
  targetLang = "id",
): Promise<string> {
  const cacheKey = `sub:translated:${targetLang}:${sourceUrl}`;
  const hit = await cache().get<string>(cacheKey);
  if (hit) return hit;

  const response = await fetch(sourceUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0",
      Accept: "text/vtt,text/plain,*/*",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch source subtitle: ${response.status}`);
  }

  const rawText = await response.text();
  const translated = await translateVttText(rawText, targetLang);

  // Cache for 7 days (604800 seconds)
  await cache().set(cacheKey, translated, 604800);
  return translated;
}
