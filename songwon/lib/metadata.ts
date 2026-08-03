import { parseBlob } from "music-metadata";

export interface ExtractedMetadata {
  title: string;
  artist: string;
  album?: string;
  duration: number;
  picture?: string;
}

export async function extractMetadata(
  file: File
): Promise<ExtractedMetadata> {
  const metadata = await parseBlob(file);
  const { common, format } = metadata;

  let picture: string | undefined;
  if (common.picture && common.picture.length > 0) {
    const pic = common.picture[0];
    const buffer = pic.data.buffer.slice(
      pic.data.byteOffset,
      pic.data.byteOffset + pic.data.byteLength
    ) as ArrayBuffer;
    const blob = new Blob([buffer], { type: pic.format });
    picture = URL.createObjectURL(blob);
  }

  return {
    title: common.title || file.name.replace(/\.[^/.]+$/, ""),
    artist: common.artist || "알 수 없음",
    album: common.album,
    duration: format.duration || 0,
    picture,
  };
}

export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}
