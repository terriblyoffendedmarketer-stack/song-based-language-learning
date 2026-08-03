import { NextRequest } from "next/server";
import { getClient } from "@/lib/claude";
import {
  LESSON_SYSTEM_PROMPT,
  buildLessonPrompt,
} from "@/lib/prompts/lesson";
import type { LessonAnalysis, UserLevel } from "@/lib/types";

export async function POST(request: NextRequest) {
  try {
    const { title, artist, analysis, level, sectionIndex } =
      (await request.json()) as {
        title: string;
        artist: string;
        analysis: LessonAnalysis;
        level: UserLevel;
        sectionIndex: number;
      };

    if (!title || !artist || !analysis) {
      return Response.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const client = getClient();
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        try {
          const messageStream = client.messages.stream({
            model: "claude-sonnet-4-20250514",
            max_tokens: 6000,
            system: LESSON_SYSTEM_PROMPT,
            messages: [
              {
                role: "user",
                content: buildLessonPrompt(
                  title,
                  artist,
                  analysis,
                  level || "beginner",
                  sectionIndex ?? 0
                ),
              },
            ],
          });

          for await (const event of messageStream) {
            if (
              event.type === "content_block_delta" &&
              event.delta.type === "text_delta"
            ) {
              const data = JSON.stringify({ text: event.delta.text });
              controller.enqueue(
                encoder.encode(`data: ${data}\n\n`)
              );
            }
          }

          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        } catch (error) {
          console.error("Stream error:", error);
          const errMsg = JSON.stringify({
            error: "Stream failed",
          });
          controller.enqueue(
            encoder.encode(`data: ${errMsg}\n\n`)
          );
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("Lesson generation error:", error);
    return Response.json(
      { error: "Failed to generate lesson" },
      { status: 500 }
    );
  }
}
