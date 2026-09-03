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
 * PRIVILEGES: under the knowledge security model the normal Supabase server
 * client (authenticated/anon) holds NO direct table privileges, and this
 * route deliberately does NOT weaken that. Until developer-only ingestion
 * is authorized separately (e.g. a service-role client), every record fails
 * with a database permission error — reported per record in the summary.
 *
 * DELETE THIS ROUTE before production.
 */

import { ingestManualSeedRecords } from "@/lib/knowledge/rag";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const summary = await ingestManualSeedRecords();

    return Response.json({
      success: summary.failures.length === 0,
      summary,
    });
  } catch (err) {
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
