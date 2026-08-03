import { NextRequest, NextResponse } from "next/server";
import { readFile, stat } from "fs/promises";
import path from "path";

const AUDIO_DIR = path.join(process.cwd(), "pipeline", "audio");

export async function GET(request: NextRequest) {
  const song = request.nextUrl.searchParams.get("song");
  if (!song) {
    return NextResponse.json({ error: "Missing song parameter" }, { status: 400 });
  }

  const filename = `${song}.mp3`;
  const filePath = path.join(AUDIO_DIR, filename);

  // Prevent directory traversal
  if (!filePath.startsWith(AUDIO_DIR)) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  try {
    const fileStat = await stat(filePath);
    const rangeHeader = request.headers.get("range");

    if (rangeHeader) {
      const match = rangeHeader.match(/bytes=(\d+)-(\d*)/);
      if (match) {
        const start = parseInt(match[1], 10);
        const end = match[2] ? parseInt(match[2], 10) : fileStat.size - 1;
        const chunk = await readFile(filePath);
        const sliced = chunk.slice(start, end + 1);

        return new NextResponse(sliced, {
          status: 206,
          headers: {
            "Content-Type": "audio/mpeg",
            "Content-Length": String(sliced.length),
            "Content-Range": `bytes ${start}-${end}/${fileStat.size}`,
            "Accept-Ranges": "bytes",
            "Cache-Control": "public, max-age=31536000, immutable",
          },
        });
      }
    }

    const data = await readFile(filePath);
    return new NextResponse(data, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Length": String(fileStat.size),
        "Accept-Ranges": "bytes",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return NextResponse.json({ error: "Audio not found" }, { status: 404 });
  }
}
