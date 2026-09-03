/**
 * DEV-ONLY ingestion trigger for the training-manual seed records.
 *
 * POST /api/knowledge/ingest-manual
 *
 * Accepts NO request body and NO query parameters — it only ingests the
 * hard-coded records from src/lib/knowledge/rag/manual-seed.ts, which must
 * be filled manually with verified manual content. There is deliberately
 * no way to ingest arbitrary text through this route.
 *
 * Re-running is safe: document rows are reused, and duplicate chunks are
 * skipped by the deterministic duplicate check.
 *
 * PRIVILEGES: raw knowledge tables grant nothing to anon/authenticated, and
 * this route deliberately does NOT weaken that model. Writing seed rows is
 * authorized through a service-role admin client created HERE and only
 * HERE (src/lib/supabase/admin.ts): it is never exposed to client
 * components, never logged, never returned in responses, and never used
 * by normal app flows, which keep the standard authenticated client.
 * Retrieval stays locked to the SECURITY DEFINER match_knowledge_chunks RPC.
 *
 * ENVIRONMENT GUARD: the route refuses to run when NODE_ENV is
 * "production", and the admin client factory independently refuses to
 * construct outside development.
 *
 * DELETE THIS ROUTE before production.
 */

import { ingestManualSeedRecords } from "@/lib/knowledge/rag";
import {
  createKnowledgeAdminClient,
  SupabaseAdminClientError,
} from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function POST() {
  // Dev-only route: refuse in production before touching any secret.
  if (process.env.NODE_ENV === "production") {
    return Response.json(
      {
        success: false,
        error: "This dev-only route is disabled in production.",
      },
      { status: 403 },
    );
  }

  try {
    // Service-role admin client — created in this handler and passed ONLY
    // down the ingestion path; it is discarded when the request completes.
    const supabase = createKnowledgeAdminClient();

    const summary = await ingestManualSeedRecords({ supabase });

    return Response.json({
      success: summary.failures.length === 0,
      summary,
    });
  } catch (err) {
    // Configuration problems (e.g. missing service-role key) surface here
    // with sanitized messages that never contain the key itself.
    if (err instanceof SupabaseAdminClientError) {
      return Response.json(
        { success: false, error: err.message },
        { status: 503 },
      );
    }

    // ingestManualSeedRecords reports per-record problems in its summary;
    // reaching this handler means something unexpected failed.
    console.error(
      "Manual seed ingestion crashed:",
      err instanceof Error ? err.message : err,
    );
    return Response.json(
      {
        success: false,
        error: "Manual seed ingestion failed unexpectedly.",
      },
      { status: 500 },
    );
  }
}
