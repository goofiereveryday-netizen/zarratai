/**
 * RAG Knowledge Layer — Training-Manual Seed Records
 *
 * Server-only module. Do not import from client components.
 *
 * ============================================================================
 * THIS FILE INTENTIONALLY CONTAINS ZERO AGRICULTURAL RECORDS.
 * ============================================================================
 *
 * The manual consists of three source parts (PDFs) that Qoder cannot read
 * directly. Records are therefore provided ONLY as manually verified rows
 * added to MANUAL_SEED_RECORDS below by a human who has read the manual.
 *
 * RULES (identical to the Phase 2A dataset contract):
 *   1. Do NOT invent manual content, page numbers, crops, or problem names.
 *   2. `sourcePage` must be the exact page number the content was read from.
 *   3. `content` is the manually verified knowledge text for that page —
 *      recorded exactly as the manual states it.
 *   4. `crop` is written in trimmed lowercase (e.g. "wheat") to match the
 *      crop-filter normalization used by match_knowledge_chunks.
 *   5. `problemType` uses the shared ProblemType vocabulary.
 *   6. Ingestion stamps verification_status = "requires_current_verification"
 *      and pesticide_actionable = false on every row — these are NOT part
 *      of the seed record because they are not negotiable.
 */

import type { ProblemType } from "../types";

/**
 * The three physical source parts of the training manual, keyed by a stable
 * short identifier. The values are the exact source-part file names as
 * provided by the manual's owner.
 */
export const MANUAL_SOURCE_PARTS = {
  "part-1": "1st 35 pages of pesticide book.pdf",
  "part-2": "till 66 pages of pesticide book.pdf",
  "part-3": "from 67 to last - remaining pesticide book .pdf",
} as const;

export type ManualSourcePart = keyof typeof MANUAL_SOURCE_PARTS;

/** One manually verified knowledge chunk extracted from the manual. */
export type ManualSeedRecord = {
  /** Which of the three manual PDFs this record was read from. */
  sourcePart: ManualSourcePart;
  /** Exact page number in the manual — never invented. */
  sourcePage: number;
  /** Crop name, trimmed lowercase (e.g. "wheat"). */
  crop: string;
  /** Problem category from the shared ProblemType vocabulary. */
  problemType: ProblemType;
  /** Problem name exactly as the manual states it. */
  problemName: string;
  /** The manually verified knowledge text for this chunk. */
  content: string;
};

/**
 * Training-manual seed records for RAG ingestion.
 *
 * EMPTY until the manually verified manual content is provided. Add records
 * here using the template below — never commit placeholder data.
 */
export const MANUAL_SEED_RECORDS: readonly ManualSeedRecord[] = [];

// ---------------------------------------------------------------------------
// RECORD TEMPLATE — for manually verified ingestion only.
//
// {
//   sourcePart: "part-1", // "part-1" | "part-2" | "part-3"
//   sourcePage: <exact page number in the manual>,
//   crop: "<crop, trimmed lowercase>",
//   problemType: "disease", // pest | disease | weed | nutrient_deficiency | physiological | other
//   problemName: "<problem name exactly as the manual states it>",
//   content: "<manually verified knowledge text from that page>",
// }
// ---------------------------------------------------------------------------
