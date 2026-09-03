/**
 * DEV-ONLY connectivity test for the Gemini embedding API.
 *
 * Verifies that the server-side GEMINI_API_KEY can generate a
 * 768-dimensional embedding, matching the pgvector `vector(768)`
 * column on knowledge_chunks.
 * DELETE THIS ROUTE before production.
 */

export const dynamic = "force-dynamic";

const TEST_MODEL = "gemini-embedding-2";
const EMBED_URL = `https://generativelanguage.googleapis.com/v1beta/models/${TEST_MODEL}:embedContent`;
const TEST_TEXT = "Wheat leaves are turning yellow.";
const EXPECTED_DIMENSIONS = 768;

/** Hard cap so a hung upstream request cannot stall the route handler. */
const REQUEST_TIMEOUT_MS = 30_000;

type EmbedContentResponse = {
  embedding?: { values?: number[] };
};

export async function GET() {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return Response.json(
      {
        success: false,
        model: TEST_MODEL,
        error: "Missing GEMINI_API_KEY on the server.",
      },
      { status: 500 },
    );
  }

  try {
    const res = await fetch(EMBED_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        content: { parts: [{ text: TEST_TEXT }] },
        output_dimensionality: EXPECTED_DIMENSIONS,
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!res.ok) {
      // Full upstream detail stays in the server log only.
      const body = await res.text();
      console.error(
        `Gemini embedding request failed with status ${res.status}: ${body.slice(0, 500)}`
      );
      return Response.json(
        {
          success: false,
          model: TEST_MODEL,
          error: `Gemini embedding request failed with status ${res.status}.`,
        },
        { status: 502 },
      );
    }

    const data = (await res.json()) as EmbedContentResponse;
    const values = data.embedding?.values ?? [];

    if (values.length === 0) {
      return Response.json(
        {
          success: false,
          model: TEST_MODEL,
          error: "Gemini returned no embedding values.",
        },
        { status: 502 },
      );
    }

    if (values.length !== EXPECTED_DIMENSIONS) {
      return Response.json(
        {
          success: false,
          model: TEST_MODEL,
          error: `Expected ${EXPECTED_DIMENSIONS} dimensions, received ${values.length}.`,
        },
        { status: 502 },
      );
    }

    // Only the first few values leave the server — never the full vector.
    return Response.json({
      success: true,
      model: TEST_MODEL,
      dimensions: values.length,
      sample: values.slice(0, 5),
    });
  } catch (err) {
    return Response.json(
      {
        success: false,
        model: TEST_MODEL,
        error:
          err instanceof Error
            ? `Fetch failed: ${err.message}`
            : "Unknown fetch error",
      },
      { status: 500 },
    );
  }
}
