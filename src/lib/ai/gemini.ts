/**
 * Minimal server-side client for the Google Gemini generateContent API.
 *
 * This is the provider-specific transport layer — product code should build
 * prompts through lib/ai/assistant instead of calling this directly.
 *
 * GEMINI_API_KEY is read here and never leaves the server: upstream errors
 * are logged server-side and re-thrown as sanitized GeminiError values so raw
 * upstream responses cannot reach the browser.
 *
 * The transport uses a retry + model-fallback strategy for transient failures
 * (HTTP 429/5xx, timeouts, network errors):
 *   1. gemini-3.5-flash (primary) — first attempt.
 *   2. gemini-3.5-flash (primary) — one retry (after a short delay).
 *   3. gemini-3.5-flash-lite (fallback) — single attempt with the fastest variant.
 * Permanent failures (malformed request, auth errors, safety rejections) fail
 * fast without retrying.
 */

/**
 * Primary generation model. gemini-3.5-flash was selected after diagnostic
 * testing: gemini-3.6-flash timed out on a 20-byte prompt (20 s timeout)
 * in 1 of 3 runs, while gemini-3.5-flash was consistently 1–2 s.
 */
const PRIMARY_MODEL = "gemini-3.5-flash";

/**
 * Fallback model used when the primary fails transiently.
 * gemini-3.5-flash-lite is the fastest variant (sub-1 s for tiny prompts)
 * and serves as a reliable last resort for interactive demos.
 */
const FALLBACK_MODEL = "gemini-3.5-flash-lite";

/**
 * Per-attempt timeout. Diagnostic testing showed gemini-3.5-flash and
 * gemini-3.5-flash-lite complete tiny prompts in 1–2 s; with the full
 * assistant payload (system instruction + RAG + history ≈ 10 KB) the
 * expected latency is 3–8 s. 15 s per attempt keeps the worst-case
 * interactive wait under 50 s (3 × 15 s + 2 × 750 ms ≈ 46.5 s).
 */
const PER_ATTEMPT_TIMEOUT_MS = 15_000;

/** Brief pause before the next attempt, giving transient spikes time to clear. */
const RETRY_DELAY_MS = 750;

/** HTTP status codes considered transient (worth retrying). */
const TRANSIENT_STATUSES = new Set([408, 429, 500, 502, 503, 504]);

/**
 * Gemini finish reasons that indicate a permanent content-level rejection.
 * These are NOT retried — retrying the same prompt would be rejected again.
 */
const PERMANENT_FINISH_REASONS = new Set([
  "SAFETY",
  "PROHIBITED_CONTENT",
  "BLOCKLIST",
]);

function buildGenerateUrl(model: string): string {
  return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
}

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

/** Result of a single attempt — either usable text or a classified failure. */
type AttemptResult =
  | { ok: true; text: string }
  | { ok: false; transient: boolean; error: GeminiError };

/**
 * Performs a single generateContent call against the given model. Never throws:
 * all failures are returned as a discriminated result so the retry loop can
 * decide whether to continue or fail fast.
 */
async function attemptGenerateText(options: {
  model: string;
  apiKey: string;
  requestBody: unknown;
}): Promise<AttemptResult> {
  let res: Response;
  try {
    res = await fetch(buildGenerateUrl(options.model), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": options.apiKey,
      },
      body: JSON.stringify(options.requestBody),
      signal: AbortSignal.timeout(PER_ATTEMPT_TIMEOUT_MS),
    });
  } catch (err) {
    // Network failure or AbortSignal.timeout — both transient.
    const message = err instanceof Error ? err.message : String(err);
    console.error(
      `Gemini request could not be completed (${options.model}): ${message}`
    );
    return {
      ok: false,
      transient: true,
      error: new GeminiError("Could not reach the Gemini API."),
    };
  }

  if (!res.ok) {
    // Full upstream detail stays in the server log only (truncated, no secrets).
    const body = await res.text();
    console.error(
      `Gemini request failed with status ${res.status} (${options.model}): ${body.slice(0, 500)}`
    );
    return {
      ok: false,
      transient: TRANSIENT_STATUSES.has(res.status),
      error: new GeminiError(`Gemini request failed with status ${res.status}.`),
    };
  }

  const data = (await res.json()) as GeminiResponse;
  const candidate = data.candidates?.[0];
  const text = (candidate?.content?.parts ?? [])
    .map((part) => part.text ?? "")
    .join("")
    .trim();

  if (!text) {
    const reason = candidate?.finishReason ?? "unknown";
    console.error(
      `Gemini returned no usable text (${options.model}, finishReason: ${reason}).`
    );
    return {
      ok: false,
      // Safety/prohibited rejections are permanent; anything else is worth one retry.
      transient: !PERMANENT_FINISH_REASONS.has(reason),
      error: new GeminiError("Gemini returned no usable text."),
    };
  }

  return { ok: true, text };
}

/**
 * Sends a system instruction plus an alternating user/model conversation to
 * Gemini and returns the generated text. Turns may carry an optional inline
 * image for vision input. Throws GeminiError when the API key is missing, the
 * request fails permanently, or every retry/fallback attempt is exhausted.
 *
 * The request body (system instruction, history, RAG context, image content,
 * safety prompts) is built once and sent identically to every attempt — the
 * fallback model receives exactly the same prompt as the primary.
 */
export async function generateGeminiText(options: {
  systemInstruction: string;
  turns: GeminiTurn[];
}): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new GeminiError("GEMINI_API_KEY is not configured on the server.");
  }

  // Build once — every attempt (primary, retry, fallback) sends this identically,
  // preserving system instruction, conversation history, RAG context, inline
  // image data and safety prompts.
  const requestBody = {
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
  };

  const attempts = [
    { model: PRIMARY_MODEL, label: "primary" },
    { model: PRIMARY_MODEL, label: "retry" },
    { model: FALLBACK_MODEL, label: "fallback" },
  ] as const;

  let lastError: GeminiError | null = null;

  for (let i = 0; i < attempts.length; i++) {
    const { model } = attempts[i];

    if (i > 0) {
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    }

    const result = await attemptGenerateText({ model, apiKey, requestBody });

    if (result.ok) {
      return result.text;
    }

    lastError = result.error;

    if (!result.transient) {
      // Permanent failure (malformed request, auth, safety rejection) — fail fast.
      throw result.error;
    }
    // Transient — continue to the next attempt.
  }

  // All attempts exhausted.
  console.error("Gemini: all attempts failed.");
  throw lastError ?? new GeminiError("Gemini request failed after all attempts.");
}
