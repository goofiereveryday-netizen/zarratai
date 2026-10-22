import {
  corsHeaders,
  getAuthenticatedSupabase,
  jsonResponse,
  optionsResponse,
} from "../_shared/http.ts";

const ELEVENLABS_TTS_URL = "https://api.elevenlabs.io/v1/text-to-speech";
const MODEL_ID = "eleven_multilingual_v2";
const MAX_TEXT_LENGTH = 5_000;
const UPSTREAM_TIMEOUT_MS = 30_000;

function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/`(.+?)`/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^[-*]\s+/gm, "")
    .replace(/^\d+\.\s+/gm, "")
    .replace(/\n+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

Deno.serve(async (request: Request): Promise<Response> => {
  if (request.method === "OPTIONS") return optionsResponse();
  if (request.method !== "POST") {
    return jsonResponse({ success: false, error: "Method not allowed." }, 405);
  }

  let auth: Awaited<ReturnType<typeof getAuthenticatedSupabase>>;
  try {
    auth = await getAuthenticatedSupabase(request);
  } catch (error) {
    console.error(
      "TTS Supabase configuration error:",
      error instanceof Error ? error.message : "unknown",
    );
    return jsonResponse(
      { success: false, error: "Service is not configured." },
      503,
    );
  }
  if (!auth) {
    return jsonResponse(
      { success: false, error: "Authentication required." },
      401,
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse(
      { success: false, error: "Invalid request body." },
      400,
    );
  }
  const rawText = typeof body === "object" && body !== null && "text" in body &&
      typeof (body as { text: unknown }).text === "string"
    ? (body as { text: string }).text
    : "";
  if (!rawText.trim()) {
    return jsonResponse(
      { success: false, error: "Message text is required." },
      400,
    );
  }
  if (rawText.length > MAX_TEXT_LENGTH) {
    return jsonResponse(
      { success: false, error: "Message text is too long." },
      413,
    );
  }

  const text = stripMarkdown(rawText);
  if (!text) {
    return jsonResponse(
      { success: false, error: "Message text is required." },
      400,
    );
  }

  const apiKey = Deno.env.get("ELEVENLABS_API_KEY");
  const voiceId = Deno.env.get("ELEVENLABS_VOICE_ID");
  if (!apiKey || !voiceId) {
    return jsonResponse({
      success: false,
      error: "Text-to-speech is not configured.",
    }, 503);
  }

  try {
    const upstream = await fetch(
      `${ELEVENLABS_TTS_URL}/${encodeURIComponent(voiceId)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "xi-api-key": apiKey },
        body: JSON.stringify({ text, model_id: MODEL_ID }),
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      },
    );
    if (!upstream.ok || !upstream.body) {
      console.error(`ElevenLabs TTS failed with status ${upstream.status}.`);
      return jsonResponse(
        { success: false, error: "Text-to-speech failed." },
        502,
      );
    }
    return new Response(upstream.body, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error(
      "ElevenLabs TTS request failed:",
      error instanceof Error ? error.message : "unknown",
    );
    return jsonResponse(
      { success: false, error: "Text-to-speech failed." },
      502,
    );
  }
});
