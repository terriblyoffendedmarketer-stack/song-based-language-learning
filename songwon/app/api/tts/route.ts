import { NextRequest } from "next/server";

const TTS_API_URL = "https://texttospeech.googleapis.com/v1/text:synthesize";

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.GOOGLE_CLOUD_TTS_KEY;
    if (!apiKey) {
      return Response.json(
        { error: "Google Cloud TTS API key not configured" },
        { status: 500 }
      );
    }

    const { text, speed } = (await request.json()) as {
      text: string;
      speed?: number;
    };

    if (!text || text.length > 500) {
      return Response.json(
        { error: "Text is required and must be under 500 characters" },
        { status: 400 }
      );
    }

    const speakingRate = Math.max(0.5, Math.min(2.0, speed ?? 0.9));

    const body = {
      input: { text },
      voice: {
        languageCode: "ko-KR",
        name: "ko-KR-Neural2-A",
        ssmlGender: "FEMALE",
      },
      audioConfig: {
        audioEncoding: "MP3",
        speakingRate,
        pitch: 0,
        volumeGainDb: 0,
      },
    };

    const res = await fetch(`${TTS_API_URL}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("TTS API error:", err);
      return Response.json(
        { error: "TTS synthesis failed" },
        { status: res.status }
      );
    }

    const data = await res.json();
    const audioBytes = Buffer.from(data.audioContent, "base64");

    return new Response(audioBytes, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "public, max-age=604800",
      },
    });
  } catch (error) {
    console.error("TTS route error:", error);
    return Response.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
