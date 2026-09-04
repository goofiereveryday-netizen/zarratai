/**
 * RAG Knowledge Layer — Curated Seed Ingestion (DEV-ONLY UTILITY)
 *
 * Server-only module. Do not import from client components.
 *
 * Ingests the curated, provenance-preserving demo records from
 * ./zarratai-curated-seed-batch into Supabase: real knowledge rows →
 * Gemini embeddings → knowledge_chunks.
 *
 * Unlike the training-manual ingestion path (ingest.ts), this function
 * handles multiple source tiers (government / manufacturer / training
 * manual / safety poster) and preserves each record's individual
 * verificationStatus. Every chunk is hard-coded to
 * pesticide_actionable = false — the curated batch intentionally avoids
 * actionable pesticide recommendations.
 *
 * The existing dedup logic (findDuplicateChunk) is reused unchanged.
 * The existing DEV-only service-role admin client injection
 * (KnowledgeDbClientOptions) is reused identically.
 *
 * This function accepts NO external content input — it only reads the
 * local curated seed file. There is deliberately no parameter for
 * arbitrary content.
 */

import {
  findDuplicateChunk,
  getOrCreateKnowledgeDocument,
  insertKnowledgeChunk,
  normalizeCropForKnowledge,
  type KnowledgeDbClientOptions,
} from "./db";
import {
  generateKnowledgeEmbedding,
} from "./embedding";
import {
  CURATED_SEED_BATCH,
  type CuratedSeedRecord,
} from "./zarratai-curated-seed-batch";

/** Runtime mirror of the ProblemType union from ../types. */
const PROBLEM_TYPES: ReadonlySet<string> = new Set([
  "pest",
  "disease",
  "weed",
  "nutrient_deficiency",
  "physiological",
  "other",
]);

/** Verification statuses the curated batch may carry. */
const VERIFICATION_STATUSES: ReadonlySet<string> = new Set([
  "verified_source",
  "requires_current_verification",
]);

/** Source types the curated batch may carry. */
const SOURCE_TYPES: ReadonlySet<string> = new Set([
  "training_manual",
  "government_report",
  "manufacturer",
  "safety_poster",
]);

export type CuratedSeedFailure = {
  /** Index of the record in CURATED_SEED_BATCH. */
  index: number;
  sourceDocument: string;
  sourcePage: number | null;
  reason: string;
};

export type CuratedSeedIngestionSummary = {
  totalRecords: number;
  documentsCreated: number;
  documentsReused: number;
  chunksInserted: number;
  chunksSkippedDuplicates: number;
  /** Chunks inserted without a completed duplicate check (e.g. missing SELECT grant). */
  chunksInsertedWithoutDedupCheck: number;
  failures: CuratedSeedFailure[];
};

/** Structural validation for curated seed records. */
function validateCuratedRecord(record: CuratedSeedRecord): string | null {
  if (!record.crop?.trim()) {
    return "crop must not be empty.";
  }
  if (!record.sourceDocument?.trim()) {
    return "sourceDocument must not be empty.";
  }
  if (!Number.isInteger(record.sourcePage) || record.sourcePage < 1) {
    return `Invalid sourcePage "${String(record.sourcePage)}" — must be a positive integer.`;
  }
  if (!PROBLEM_TYPES.has(record.problemType)) {
    return `Unknown problemType "${String(record.problemType)}".`;
  }
  if (!record.problemName?.trim()) {
    return "problemName must not be empty.";
  }
  if (!record.content?.trim()) {
    return "content must not be empty.";
  }
  if (!VERIFICATION_STATUSES.has(record.verificationStatus)) {
    return `Unknown verificationStatus "${String(record.verificationStatus)}".`;
  }
  if (!SOURCE_TYPES.has(record.sourceType)) {
    return `Unknown sourceType "${String(record.sourceType)}".`;
  }
  if (!Number.isInteger(record.sourceTier) || record.sourceTier < 1) {
    return `Invalid sourceTier "${String(record.sourceTier)}".`;
  }
  if (record.pesticideActionable !== false) {
    return "pesticideActionable must be false.";
  }
  return null;
}

/**
 * Ingests every record in CURATED_SEED_BATCH into Supabase.
 *
 * Flow per source document:
 *   1. getOrCreateKnowledgeDocument — one knowledge_documents row per
 *      unique sourceDocument (reused across runs, so repeated ingestion
 *      never duplicates it).
 *   2. Duplicate pre-check via findDuplicateChunk (same logic as the
 *      training-manual path).
 *   3. Gemini embedding (768 dimensions) + insertKnowledgeChunk with
 *      the record's verificationStatus and pesticide_actionable=false.
 *
 * Never throws — every problem is reported per record in the summary.
 */
export async function ingestCuratedSeedRecords(
  options?: KnowledgeDbClientOptions,
): Promise<CuratedSeedIngestionSummary> {
  const summary: CuratedSeedIngestionSummary = {
    totalRecords: CURATED_SEED_BATCH.length,
    documentsCreated: 0,
    documentsReused: 0,
    chunksInserted: 0,
    chunksSkippedDuplicates: 0,
    chunksInsertedWithoutDedupCheck: 0,
    failures: [],
  };

  if (CURATED_SEED_BATCH.length === 0) {
    return summary;
  }

  // Group valid records by sourceDocument; invalid ones fail immediately.
  const groups = new Map<
    string,
    { record: CuratedSeedRecord; index: number }[]
  >();

  CURATED_SEED_BATCH.forEach((record, index) => {
    const validationError = validateCuratedRecord(record);
    if (validationError) {
      summary.failures.push({
        index,
        sourceDocument: record?.sourceDocument ?? "unknown",
        sourcePage: record?.sourcePage ?? null,
        reason: validationError,
      });
      return;
    }

    const sourcePart = record.sourcePart ?? null;
    const key = sourcePart
      ? `${record.sourceDocument}|${sourcePart}`
      : record.sourceDocument;
    const bucket = groups.get(key) ?? [];
    bucket.push({ record, index });
    groups.set(key, bucket);
  });

  for (const [, records] of groups) {
    // All records in one group share the same sourceDocument (and
    // sourcePart when applicable); tier, type, publisher, and date are
    // consistent within a source.
    const first = records[0].record;
    const sourcePart = first.sourcePart ?? null;

    // Title format: when sourcePart is set, append it after an em-dash
    // to match the original training-manual ingestion convention.
    const title = sourcePart
      ? `${first.sourceDocument} — ${sourcePart}`
      : first.sourceDocument;

    let documentId: string;
    try {
      const { document, created } = await getOrCreateKnowledgeDocument(
        {
          title,
          sourceDocument: first.sourceDocument,
          sourceType: first.sourceType,
          sourceTier: first.sourceTier,
          sourcePart,
          sourceDate: first.sourceDate ?? null,
          sourceUrl: null,
        },
        options,
      );
      documentId = document.id;
      if (created) {
        summary.documentsCreated += 1;
      } else {
        summary.documentsReused += 1;
      }
    } catch (err) {
      const reason = `Document row could not be created: ${err instanceof Error ? err.message : "unknown error"}`;
      for (const { record, index } of records) {
        summary.failures.push({
          index,
          sourceDocument: first.sourceDocument,
          sourcePage: record.sourcePage,
          reason,
        });
      }
      continue;
    }

    for (const { record, index } of records) {
      const crop = normalizeCropForKnowledge(record.crop);
      const problemType = record.problemType.trim();
      const problemName = record.problemName.trim();
      const content = record.content.trim();

      // 1. Duplicate pre-check before spending an embedding API call.
      const dedup = await findDuplicateChunk(
        {
          documentId,
          sourcePage: record.sourcePage,
          crop,
          problemName,
          content,
        },
        options?.supabase,
      );

      if (dedup.kind === "error") {
        console.warn(
          "Curated chunk duplicate check could not run:",
          dedup.message,
        );
      } else if (dedup.kind === "duplicate") {
        summary.chunksSkippedDuplicates += 1;
        continue;
      }

      // 2. Embed the content (768 dimensions, validated by the helper).
      let embedding: number[];
      try {
        embedding = await generateKnowledgeEmbedding(content);
      } catch (err) {
        summary.failures.push({
          index,
          sourceDocument: record.sourceDocument,
          sourcePage: record.sourcePage,
          reason:
            err instanceof Error
              ? err.message
              : "Embedding generation failed for the chunk.",
        });
        continue;
      }

      // 3. Insert with per-record verificationStatus and the mandatory
      //    pesticide_actionable=false safety flag.
      try {
        await insertKnowledgeChunk(
          {
            document_id: documentId,
            content,
            crop,
            problem_type: problemType,
            problem_name: problemName,
            source_page: record.sourcePage,
            verification_status: record.verificationStatus,
            pesticide_actionable: false,
            embedding,
          },
          options,
        );

        summary.chunksInserted += 1;
        if (dedup.kind === "error") {
          summary.chunksInsertedWithoutDedupCheck += 1;
        }
      } catch (err) {
        summary.failures.push({
          index,
          sourceDocument: record.sourceDocument,
          sourcePage: record.sourcePage,
          reason:
            err instanceof Error
              ? err.message
              : "Knowledge chunk insert failed.",
        });
      }
    }
  }

  return summary;
}
