/**
 * Minimal server-side client for the Google Gemini generateContent API.
 *
 * This is the provider-specific transport layer — product code should build
 * prompts through lib/ai/assistant instead of calling this directly.
 *
 * GEMINI_API_KEY is read here and never leaves the server: upstream errors
 * are logged server-side and re-thrown as sanitized GeminiError values so raw
 * upstream responses cannot reach the browser.
 */

const MODEL = "gemini-3.6-flash";

const GENERATE_CONTENT_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

/** Hard cap so a hung upstream request cannot stall the server action. */
const REQUEST_TIMEOUT_MS = 30_000;

/** An inline image part (raw base64, no data-URL prefix). */
export type GeminiImage = {
  mimeType: string;
  base64: string;
};

/** One conversational turn sent to the model. Gemini calls the assistant "model". */
export type GeminiTurn = {
  role: "user" | "model";
  text: string;
  /** Optional image attached to this turn as inline vision input. */
  image?: GeminiImage;
};

/** Sanitized error — safe to log, never returned to the browser as-is. */
export class GeminiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GeminiError";
  }
}

type GeminiResponse = {
  candidates?: {
    content?: { parts?: { text?: string }[] };
    finishReason?: string;
  }[];
};

/**
 * Sends a system instruction plus an alternating user/model conversation to
 * Gemini and returns the generated text. Turns may carry an optional inline
 * image for vision input. Throws GeminiError when the API key is missing, the
 * request fails, or the response carries no usable text.
 */
export async function generateGeminiText(options: {
  systemInstruction: string;
  turns: GeminiTurn[];
}): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new GeminiError("GEMINI_API_KEY is not configured on the server.");
  }

  let res: Response;
  try {
    res = await fetch(GENERATE_CONTENT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: options.systemInstruction }] },
        contents: options.turns.map((turn) => ({
          role: turn.role,
          parts: [
            ...(turn.text ? [{ text: turn.text }] : []),
            ...(turn.image
              ? [
                  {
                    inline_data: {
                      mime_type: turn.image.mimeType,
                      data: turn.image.base64,
                    },
                  },
                ]
              : []),
          ],
        })),
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (err) {
    console.error(
      "Gemini request could not be completed:",
      err instanceof Error ? err.message : err
    );
    throw new GeminiError("Could not reach the Gemini API.");
  }

  if (!res.ok) {
    // Full upstream detail stays in the server log only.
    const body = await res.text();
    console.error(
      `Gemini request failed with status ${res.status}: ${body.slice(0, 500)}`
    );
    throw new GeminiError(`Gemini request failed with status ${res.status}.`);
  }

  const data = (await res.json()) as GeminiResponse;
  const candidate = data.candidates?.[0];
  const text = (candidate?.content?.parts ?? [])
    .map((part) => part.text ?? "")
    .join("")
    .trim();

  if (!text) {
    console.error(
      `Gemini returned no usable text (finishReason: ${
        candidate?.finishReason ?? "unknown"
      }).`
    );
    throw new GeminiError("Gemini returned no usable text.");
  }

  return text;
}
