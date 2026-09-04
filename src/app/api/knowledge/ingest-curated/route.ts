/**
 * DEV-ONLY ingestion trigger for the curated seed batch.
 *
 * POST /api/knowledge/ingest-curated
 *
 * Accepts NO request body and NO query parameters — it only ingests the
 * hard-coded records from src/lib/knowledge/rag/zarratai-curated-seed-batch.ts.
 * There is deliberately no way to ingest arbitrary text through this route.
 *
 * Re-running is safe: document rows are reused, and duplicate chunks are
 * skipped by the deterministic duplicate check.
 *
 * PRIVILEGES: identical security model to /api/knowledge/ingest-manual —
 * raw knowledge tables grant nothing to anon/authenticated; writing seed
 * rows is authorized through the service-role admin client created HERE
 * and only HERE (src/lib/supabase/admin.ts).
 *
 * ENVIRONMENT GUARD: the route refuses to run when NODE_ENV is
 * "production", and the admin client factory independently refuses to
 * construct outside development.
 *
 * DELETE THIS ROUTE before production.
 */

import { ingestCuratedSeedRecords } from "@/lib/knowledge/rag";
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

    const summary = await ingestCuratedSeedRecords({ supabase });

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

    // ingestCuratedSeedRecords reports per-record problems in its summary;
    // reaching this handler means something unexpected failed.
    console.error(
      "Curated seed ingestion crashed:",
      err instanceof Error ? err.message : err,
    );
    return Response.json(
      {
        success: false,
        error: "Curated seed ingestion failed unexpectedly.",
      },
      { status: 500 },
    );
  }
}
