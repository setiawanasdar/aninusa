import { NextResponse } from "next/server";
import { translateVttFromUrl, translateVttText } from "@/lib/subtitle-translator";

export const runtime = "nodejs";
export const maxDuration = 60;

function isPrivateHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".local") || host === "::1" || host === "[::1]") return true;
  if (/^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host) || /^169\.254\./.test(host)) {
    return true;
  }
  return /^172\.(1[6-9]|2\d|3[0-1])\./.test(host);
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const url = searchParams.get("url");
    const lang = searchParams.get("lang") || "id";

    if (!url) {
      return NextResponse.json({ error: "Parameter url wajib diisi" }, { status: 400 });
    }

    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return NextResponse.json({ error: "URL subtitle tidak valid" }, { status: 400 });
    }

    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return NextResponse.json({ error: "Hanya URL http(s) yang didukung" }, { status: 400 });
    }

    if (isPrivateHost(parsed.hostname)) {
      return NextResponse.json({ error: "Host internal/privat tidak diizinkan" }, { status: 403 });
    }

    const translatedVtt = await translateVttFromUrl(url, lang);

    return new NextResponse(translatedVtt, {
      status: 200,
      headers: {
        "Content-Type": "text/vtt; charset=utf-8",
        "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    console.error("Subtitle translation error:", error);
    return NextResponse.json(
      { error: "Gagal menerjemahkan subtitle", details: String(error) },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const vtt = body?.vtt;
    const lang = body?.lang || "id";

    if (!vtt || typeof vtt !== "string") {
      return NextResponse.json({ error: "Field vtt wajib diisi dengan format string WEBVTT" }, { status: 400 });
    }

    const translated = await translateVttText(vtt, lang);

    return new NextResponse(translated, {
      status: 200,
      headers: {
        "Content-Type": "text/vtt; charset=utf-8",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Gagal memproses terjemahan VTT", details: String(error) },
      { status: 500 },
    );
  }
}
