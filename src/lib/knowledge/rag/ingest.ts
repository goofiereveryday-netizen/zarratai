/**
 * RAG Knowledge Layer — Training-Manual Seed Ingestion (DEV-ONLY UTILITY)
 *
 * Server-only module. Do not import from client components.
 *
 * Ingests the hard-coded, manually verified records from ./manual-seed into
 * Supabase: real knowledge rows → Gemini embeddings → knowledge_chunks.
 *
 * This function accepts NO external input — it only reads the local seed
 * file, which a human fills with verified manual records. There is
 * deliberately no parameter for arbitrary content.
 *
 * Every inserted chunk is stamped with the mandatory training-manual safe
 * defaults (requires_current_verification / not pesticide-actionable) by
 * embedAndInsertKnowledgeChunk, and duplicate rows are skipped.
 */

import {
  TRAINING_MANUAL_SOURCE_DOCUMENT,
  TRAINING_MANUAL_SOURCE_TIER,
  TRAINING_MANUAL_SOURCE_TYPE,
} from "../training-manual";
import {
  embedAndInsertKnowledgeChunk,
  getOrCreateKnowledgeDocument,
} from "./db";
import {
  MANUAL_SEED_RECORDS,
  MANUAL_SOURCE_PARTS,
  type ManualSeedRecord,
  type ManualSourcePart,
} from "./manual-seed";

/** Runtime mirror of the ProblemType union from ../types. */
const PROBLEM_TYPES: ReadonlySet<string> = new Set([
  "pest",
  "disease",
  "weed",
  "nutrient_deficiency",
  "physiological",
  "other",
]);

export type ManualSeedFailure = {
  /** Index of the record in MANUAL_SEED_RECORDS. */
  index: number;
  sourcePart: string;
  sourcePage: number | null;
  reason: string;
};

export type ManualSeedIngestionSummary = {
  totalRecords: number;
  documentsCreated: number;
  documentsReused: number;
  chunksInserted: number;
  chunksSkippedDuplicates: number;
  /** Chunks inserted without a completed duplicate check (e.g. missing SELECT grant). */
  chunksInsertedWithoutDedupCheck: number;
  failures: ManualSeedFailure[];
};

/** Structural validation for hand-edited seed records. */
function validateSeedRecord(record: ManualSeedRecord): string | null {
  if (!(record.sourcePart in MANUAL_SOURCE_PARTS)) {
    return `Unknown sourcePart "${String(record.sourcePart)}".`;
  }
  if (!Number.isInteger(record.sourcePage) || record.sourcePage < 1) {
    return `Invalid sourcePage "${String(record.sourcePage)}" — must be a positive integer.`;
  }
  if (!record.crop?.trim()) {
    return "crop must not be empty.";
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
  return null;
}

/**
 * Ingests every record in MANUAL_SEED_RECORDS into Supabase.
 *
 * Flow per source part:
 *   1. getOrCreateKnowledgeDocument — one knowledge_documents row per manual
 *      part (reused across runs, so repeated ingestion never duplicates it).
 *   2. embedAndInsertKnowledgeChunk — Gemini embedding + insert with the
 *      mandatory safe defaults, skipping existing duplicates.
 *
 * Never throws — every problem is reported per record in the summary.
 */
export async function ingestManualSeedRecords(): Promise<ManualSeedIngestionSummary> {
  const summary: ManualSeedIngestionSummary = {
    totalRecords: MANUAL_SEED_RECORDS.length,
    documentsCreated: 0,
    documentsReused: 0,
    chunksInserted: 0,
    chunksSkippedDuplicates: 0,
    chunksInsertedWithoutDedupCheck: 0,
    failures: [],
  };

  if (MANUAL_SEED_RECORDS.length === 0) {
    return summary;
  }

  // Group valid records by source part; invalid ones fail immediately.
  const groups = new Map<ManualSourcePart, { record: ManualSeedRecord; index: number }[]>();

  MANUAL_SEED_RECORDS.forEach((record, index) => {
    const validationError = validateSeedRecord(record);
    if (validationError) {
      summary.failures.push({
        index,
        sourcePart: String(record?.sourcePart ?? "unknown"),
        sourcePage: record?.sourcePage ?? null,
        reason: validationError,
      });
      return;
    }

    const bucket = groups.get(record.sourcePart) ?? [];
    bucket.push({ record, index });
    groups.set(record.sourcePart, bucket);
  });

  for (const [sourcePart, records] of groups) {
    const sourcePartLabel = MANUAL_SOURCE_PARTS[sourcePart];

    let documentId: string;
    try {
      const { document, created } = await getOrCreateKnowledgeDocument({
        title: `${TRAINING_MANUAL_SOURCE_DOCUMENT} — ${sourcePartLabel}`,
        sourceDocument: TRAINING_MANUAL_SOURCE_DOCUMENT,
        sourceType: TRAINING_MANUAL_SOURCE_TYPE,
        sourceTier: TRAINING_MANUAL_SOURCE_TIER,
        sourcePart: sourcePartLabel,
        // Publication date of the manual is unknown — never invented.
        sourceDate: null,
        sourceUrl: null,
      });
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
          sourcePart,
          sourcePage: record.sourcePage,
          reason,
        });
      }
      continue;
    }

    for (const { record, index } of records) {
      const outcome = await embedAndInsertKnowledgeChunk({
        document_id: documentId,
        content: record.content,
        crop: record.crop,
        problem_type: record.problemType,
        problem_name: record.problemName,
        source_page: record.sourcePage,
      });

      if (outcome.status === "inserted") {
        summary.chunksInserted += 1;
        if (!outcome.dedupChecked) {
          summary.chunksInsertedWithoutDedupCheck += 1;
        }
      } else if (outcome.status === "skipped_duplicate") {
        summary.chunksSkippedDuplicates += 1;
      } else {
        summary.failures.push({
          index,
          sourcePart,
          sourcePage: record.sourcePage,
          reason: outcome.reason,
        });
      }
    }
  }

  return summary;
}
