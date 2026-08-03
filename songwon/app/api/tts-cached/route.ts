import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { createHash } from "crypto";
import path from "path";

const CACHE_DIR = path.join(process.cwd(), "pipeline", "tts_cache");

function textHash(text: string, voice: string): string {
  return createHash("md5").update(`${text}|${voice}`).digest("hex");
}

export async function POST(request: NextRequest) {
  const { text, voice } = (await request.json()) as {
    text: string;
    voice?: string;
  };

  if (!text) {
    return NextResponse.json({ error: "Missing text" }, { status: 400 });
  }

  const v = voice || "ko-KR-SunHiNeural";
  const hash = textHash(text, v);
  const filePath = path.join(CACHE_DIR, `${hash}.mp3`);

  if (!filePath.startsWith(CACHE_DIR)) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  try {
    const data = await readFile(filePath);
    return new NextResponse(data, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "TTS not cached for this text" },
      { status: 404 }
    );
  }
}
