/**
 * POST /api/tts — text-to-speech for Urdu-heavy assistant answers.
 *
 * Requires an authenticated Supabase session (401 otherwise). Sends the
 * cleaned message text to ElevenLabs (eleven_multilingual_v2) with the
 * configured ELEVENLABS_VOICE_ID and streams the resulting MP3 straight
 * back to the browser.
 *
 * The audio is never written to disk or Supabase and never logged; the
 * ELEVENLABS_API_KEY stays server-side and is never included in any
 * response. Errors are sanitized to a short generic message before they
 * reach the client.
 */

import { stripMarkdown } from "@/lib/markdown-render";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const ELEVENLABS_TTS_URL = "https://api.elevenlabs.io/v1/text-to-speech";
const MODEL_ID = "eleven_multilingual_v2";

/** Reasonable MVP cap — keeps requests/latency bounded. */
const MAX_TEXT_LENGTH = 5000;

export async function POST(request: Request) {
  // Authenticated session required — validated server-side.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json(
      { success: false, error: "Authentication required." },
      { status: 401 },
    );
  }

  const apiKey = process.env.ELEVENLABS_API_KEY;
  const voiceId = process.env.ELEVENLABS_VOICE_ID;
  if (!apiKey || !voiceId) {
    return Response.json(
      { success: false, error: "Text-to-speech is not configured." },
      { status: 503 },
    );
  }

  // Parse and validate the request body.
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { success: false, error: "Invalid request body." },
      { status: 400 },
    );
  }

  const rawText =
    typeof body === "object" && body !== null && "text" in body
      ? String((body as { text: unknown }).text)
      : "";

  if (!rawText.trim()) {
    return Response.json(
      { success: false, error: "Message text is required." },
      { status: 400 },
    );
  }
  if (rawText.length > MAX_TEXT_LENGTH) {
    return Response.json(
      { success: false, error: "Message text is too long." },
      { status: 413 },
    );
  }

  // Strip Markdown so only spoken words reach the voice.
  const text = stripMarkdown(rawText);
  if (!text) {
    return Response.json(
      { success: false, error: "Message text is required." },
      { status: 400 },
    );
  }

  try {
    const upstream = await fetch(`${ELEVENLABS_TTS_URL}/${voiceId}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "xi-api-key": apiKey,
      },
      body: JSON.stringify({
        text,
        model_id: MODEL_ID,
      }),
    });

    if (!upstream.ok || !upstream.body) {
      // Surface only the failure — never the key, upstream body, or audio.
      return Response.json(
        { success: false, error: "Text-to-speech failed." },
        { status: 502 },
      );
    }

    // Stream the MP3 straight through — nothing is persisted anywhere.
    return new Response(upstream.body, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return Response.json(
      { success: false, error: "Text-to-speech failed." },
      { status: 502 },
    );
  }
}
