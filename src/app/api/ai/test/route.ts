/**
 * DEV-ONLY connectivity test for Google Gemini.
 * DELETE THIS ROUTE before production.
 */

export const dynamic = "force-dynamic";

const TEST_MODEL = "gemini-3.6-flash";
const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent";
const TEST_PROMPT = "Reply with exactly: ZarratAI Gemini connection successful.";

export async function GET() {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return Response.json(
      {
        success: false,
        model: TEST_MODEL,
        response: null,
        error: "Missing GEMINI_API_KEY on the server.",
      },
      { status: 500 },
    );
  }

  try {
    const res = await fetch(GEMINI_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: TEST_PROMPT }] }],
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      return Response.json(
        {
          success: false,
          model: TEST_MODEL,
          response: null,
          error: `Upstream ${res.status}: ${text.slice(0, 300)}`,
        },
        { status: 502 },
      );
    }

    const data = await res.json();
    const content: string =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "(empty response)";

    return Response.json({
      success: true,
      model: TEST_MODEL,
      response: content,
    });
  } catch (err) {
    return Response.json(
      {
        success: false,
        model: TEST_MODEL,
        response: null,
        error:
          err instanceof Error
            ? `Fetch failed: ${err.message}`
            : "Unknown fetch error",
      },
      { status: 500 },
    );
  }
}
