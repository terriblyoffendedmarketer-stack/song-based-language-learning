import { NextRequest } from "next/server";
import { getClient } from "@/lib/claude";
import {
  ANALYSIS_SYSTEM_PROMPT,
  buildAnalysisPrompt,
} from "@/lib/prompts/analysis";
import type { UserLevel } from "@/lib/types";

export async function POST(request: NextRequest) {
  try {
    const { title, artist, lyrics, level } = (await request.json()) as {
      title: string;
      artist: string;
      lyrics: string;
      level: UserLevel;
    };

    if (!title || !artist || !lyrics) {
      return Response.json(
        { error: "Missing required fields: title, artist, lyrics" },
        { status: 400 }
      );
    }

    const client = getClient();
    const message = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 8000,
      system: ANALYSIS_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: buildAnalysisPrompt(title, artist, lyrics, level || "beginner"),
        },
      ],
    });

    const textBlock = message.content.find((block) => block.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return Response.json({ error: "No text response from Claude" }, { status: 500 });
    }

    const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return Response.json({ error: "Could not parse JSON from response" }, { status: 500 });
    }

    const analysis = JSON.parse(jsonMatch[0]);
    return Response.json(analysis);
  } catch (error) {
    console.error("Analysis error:", error);
    return Response.json(
      { error: "Failed to analyze lyrics" },
      { status: 500 }
    );
  }
}
