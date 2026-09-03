/**
 * DEV-ONLY Gemini generation diagnostic.
 * DELETE THIS ROUTE before production.
 *
 * Sends the smallest possible prompt ("Reply only OK") to multiple models
 * individually, measuring latency. No RAG, no history, no farm context,
 * no system instruction — isolates transport from payload-size issues.
 *
 * GET /api/ai/gemini-diag
 * Returns: { results: [{ model, latencyMs, success, response?, error? }] }
 */

export const dynamic = "force-dynamic";

/** Longer than production to see if models respond at all when given time. */
const DIAG_TIMEOUT_MS = 20_000;

/** Tiny prompt — no system instruction, no history, no RAG. */
const TINY_PROMPT = "Reply only OK";

/** Models to test individually. */
const MODELS_TO_TEST = [
  "gemini-3.6-flash",
  "gemini-3.5-flash",
  "gemini-3.5-flash-lite",
] as const;

type ModelResult = {
  model: string;
  latencyMs: number;
  success: boolean;
  response?: string;
  error?: string;
  httpStatus?: number;
};

async function testModel(model: string, apiKey: string): Promise<ModelResult> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  const start = Date.now();

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: TINY_PROMPT }] }],
      }),
      signal: AbortSignal.timeout(DIAG_TIMEOUT_MS),
    });
  } catch (err) {
    return {
      model,
      latencyMs: Date.now() - start,
      success: false,
      error:
        err instanceof Error
          ? err.name === "TimeoutError" || err.name === "AbortError"
            ? `Timeout after ${DIAG_TIMEOUT_MS}ms`
            : err.message
          : "Unknown fetch error",
    };
  }

  const latencyMs = Date.now() - start;

  if (!res.ok) {
    const body = await res.text();
    return {
      model,
      latencyMs,
      success: false,
      httpStatus: res.status,
      error: `HTTP ${res.status}: ${body.slice(0, 300)}`,
    };
  }

  const data = await res.json();
  const text: string =
    data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "(empty)";

  return {
    model,
    latencyMs,
    success: true,
    response: text.trim(),
  };
}

export async function GET() {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return Response.json(
      { error: "Missing GEMINI_API_KEY on the server." },
      { status: 500 }
    );
  }

  const results: ModelResult[] = [];

  for (const model of MODELS_TO_TEST) {
    const result = await testModel(model, apiKey);
    results.push(result);
  }

  return Response.json({
    timestamp: new Date().toISOString(),
    timeoutMs: DIAG_TIMEOUT_MS,
    prompt: TINY_PROMPT,
    results,
  });
}
