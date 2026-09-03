/**
 * DEV-ONLY semantic retrieval test for the RAG knowledge layer.
 *
 * GET /api/knowledge/rag-test?q=yellow%20leaves%20in%20wheat&crop=Wheat
 *
 * Requires an authenticated Supabase session (401 otherwise): retrieval
 * goes through the SECURITY DEFINER match_knowledge_chunks RPC, which is
 * executable by the authenticated role only — raw knowledge tables are
 * never exposed to anon or authenticated users.
 *
 * Flow: read q (+ optional crop) → generate a 768-d Gemini embedding →
 * call the match_knowledge_chunks RPC → return safe metadata only.
 *
 * Never exposed in the response: API keys, the full query embedding, raw
 * upstream Gemini errors, or Supabase secrets.
 *
 * DELETE THIS ROUTE before production.
 */

import {
  generateKnowledgeEmbedding,
  searchKnowledgeChunks,
} from "@/lib/knowledge/rag";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** Fixed result size — this route is a connectivity/behaviour test only. */
const MATCH_COUNT = 5;

/** Upper bound for the test query text. */
const MAX_QUERY_LENGTH = 500;

export async function GET(request: Request) {
  // Authenticated session required — the RPC grants EXECUTE to the
  // authenticated role only, and getUser() validates the session server-side.
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

  const url = new URL(request.url);
  const query = (url.searchParams.get("q") ?? "").trim();
  const cropParam = (url.searchParams.get("crop") ?? "").trim();

  if (!query) {
    return Response.json(
      { success: false, error: "Missing required query parameter: q" },
      { status: 400 },
    );
  }
  if (query.length > MAX_QUERY_LENGTH) {
    return Response.json(
      {
        success: false,
        error: `q must not exceed ${MAX_QUERY_LENGTH} characters.`,
      },
      { status: 400 },
    );
  }

  // Crops are stored and filtered in trimmed lowercase (e.g. "wheat").
  const crop = cropParam ? cropParam.toLowerCase() : null;

  let embedding: number[];
  try {
    embedding = await generateKnowledgeEmbedding(query);
  } catch (err) {
    // Sanitized message only — raw upstream detail stays in the server log.
    return Response.json(
      {
        success: false,
        error:
          err instanceof Error
            ? `Embedding generation failed: ${err.message}`
            : "Embedding generation failed.",
      },
      { status: 502 },
    );
  }

  try {
    const results = await searchKnowledgeChunks({
      queryEmbedding: embedding,
      matchCount: MATCH_COUNT,
      crop,
    });

    return Response.json({
      success: true,
      query,
      crop,
      count: results.length,
      results,
    });
  } catch (err) {
    return Response.json(
      {
        success: false,
        error:
          err instanceof Error
            ? `Knowledge search failed: ${err.message}`
            : "Knowledge search failed.",
      },
      { status: 502 },
    );
  }
}
