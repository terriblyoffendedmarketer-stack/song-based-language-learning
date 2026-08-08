import { NextRequest, NextResponse } from "next/server";
import { readFile, writeFile, mkdir } from "fs/promises";
import { createHash } from "crypto";
import { execFile } from "child_process";
import { promisify } from "util";
import path from "path";
import os from "os";

const execFileAsync = promisify(execFile);
const CACHE_DIR = path.join(process.cwd(), "pipeline", "tts_cache");
const DEFAULT_VOICE = "ko-KR-SunHiNeural";

function computeHash(text: string, voice: string, rate?: string): string {
  const key = rate ? `${text}|${voice}|${rate}` : `${text}|${voice}`;
  return createHash("md5").update(key).digest("hex");
}

async function generateEdgeTTS(
  text: string,
  voice: string,
  outputPath: string,
  rate?: string
): Promise<boolean> {
  const rateArg = rate || "-10%";
  try {
    await execFileAsync("python3", [
      "-c",
      `import asyncio, edge_tts, sys
async def gen():
    c = edge_tts.Communicate(sys.argv[1], sys.argv[2], rate=sys.argv[3])
    await c.save(sys.argv[4])
asyncio.run(gen())`,
      text,
      voice,
      rateArg,
      outputPath,
    ], { timeout: 10000 });
    return true;
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  const { text, voice, rate } = (await request.json()) as {
    text: string;
    voice?: string;
    rate?: string;
  };

  if (!text) {
    return NextResponse.json({ error: "Missing text" }, { status: 400 });
  }

  const v = voice || DEFAULT_VOICE;
  const hash = computeHash(text, v, rate);
  const filePath = path.join(CACHE_DIR, `${hash}.mp3`);

  if (!filePath.startsWith(CACHE_DIR)) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  // Try serving from cache
  try {
    const data = await readFile(filePath);
    return new NextResponse(data, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    // Cache miss — fall through to on-demand generation
  }

  // Generate on-demand via Python edge-tts
  await mkdir(CACHE_DIR, { recursive: true });
  const tmpPath = path.join(os.tmpdir(), `tts_${hash}.mp3`);
  const ok = await generateEdgeTTS(text, v, tmpPath, rate);

  if (!ok) {
    return NextResponse.json(
      { error: "TTS generation failed" },
      { status: 500 }
    );
  }

  try {
    const data = await readFile(tmpPath);
    // Save to cache
    try {
      await writeFile(filePath, data);
    } catch {
      // Cache write failed — still serve the audio
    }
    return new NextResponse(data, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to read generated audio" },
      { status: 500 }
    );
  }
}
