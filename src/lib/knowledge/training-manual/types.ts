/**
 * Training-Manual Knowledge Dataset — Entry Contract & Provenance Stamp
 * (Phase 2A: structured ingestion from the government-related agricultural
 * training manual)
 *
 * Server-only module. Do not import from client components.
 *
 * ============================================================================
 * TRAINING MANUAL DATA IS NON-ACTIONABLE FOR PESTICIDE RECOMMENDATIONS
 * UNTIL CROSS-VERIFIED AGAINST CURRENT TIER 1/2 SOURCES.
 * ============================================================================
 *
 * This module reuses the shared AgriculturalKnowledgeEntry schema from
 * ../types — it deliberately does NOT define a parallel, incompatible schema.
 * The types below only NARROW the shared types to the values that are legal
 * for training-manual entries, so the Phase 2A source rules are enforced by
 * the TypeScript compiler rather than by convention:
 *
 *   - sourceType                        → always "training_manual"
 *   - sourceTier                        → always 3
 *   - verificationStatus                → always "requires_current_verification"
 *   - sourceDocument                    → always the dataset-wide manual identifier
 *   - pesticide.registrationStatus      → only "requires_verification" | "unknown"
 *
 * Training-manual pesticide information must NEVER pass actionable pesticide
 * verification by itself. See ../pesticide-verification.ts: Tier 3 sources are
 * hard-blocked from independent actionable pesticide recommendations, and
 * only "confirmed_current" registration (which a dated manual can never
 * establish) passes the registration gate.
 */

import type {
  AgriculturalKnowledgeEntry,
  PesticideDetails,
  SourceProvenance,
} from "../types";

// ---------------------------------------------------------------------------
// Dataset-wide manual identity
// ---------------------------------------------------------------------------

/**
 * Interim identifier for the agricultural dealer training manual.
 * The manual's publisher has NOT been verified — it must not be presented
 * as an official Government of Punjab publication until that is confirmed
 * from the physical document. Interim placeholder until the exact manual
 * title is available.
 *
 * Every training-manual entry must cite exactly this document identifier so
 * provenance stays auditable and consistent across the dataset.
 */
export const TRAINING_MANUAL_SOURCE_DOCUMENT =
  "Agricultural Dealer Training Manual (Punjab) — Publisher Unverified" as const;

/** Fixed source classification for all training-manual entries. */
export const TRAINING_MANUAL_SOURCE_TYPE = "training_manual" as const;

/** Fixed source tier for all training-manual entries (Tier 3 = training manual). */
export const TRAINING_MANUAL_SOURCE_TIER = 3 as const;

/**
 * Fixed verification status for all training-manual entries.
 * Training-manual data is NEVER "verified_current" on its own — it always
 * requires cross-verification against current Tier 1/2 sources first.
 */
export const TRAINING_MANUAL_VERIFICATION_STATUS =
  "requires_current_verification" as const;

// ---------------------------------------------------------------------------
// Narrowed entry types (still assignable to the shared knowledge types)
// ---------------------------------------------------------------------------

/**
 * Provenance shape that is legal for training-manual entries only.
 */
export type TrainingManualProvenance = SourceProvenance & {
  sourceType: typeof TRAINING_MANUAL_SOURCE_TYPE;
  sourceTier: typeof TRAINING_MANUAL_SOURCE_TIER;
  verificationStatus: typeof TRAINING_MANUAL_VERIFICATION_STATUS;
  sourceDocument: typeof TRAINING_MANUAL_SOURCE_DOCUMENT;
};

/**
 * Pesticide details as they may legally appear in a training-manual entry.
 *
 * `registrationStatus` is narrowed to "requires_verification" | "unknown".
 * A dated training manual can NEVER establish current registration, so
 * "confirmed_current" is a compile-time error here. Definitive negative
 * claims ("expired_or_withdrawn", "not_registered") are equally unavailable
 * without checking current official records.
 */
export type TrainingManualPesticideDetails = PesticideDetails & {
  registrationStatus: "requires_verification" | "unknown";
};

/**
 * One structured training-manual entry.
 *
 * This is AgriculturalKnowledgeEntry with the manual-only provenance and
 * pesticide constraints applied. TrainingManualEntry[] is assignable to
 * AgriculturalKnowledgeEntry[], so the existing retrieval/verification code
 * consumes this dataset without any adapter.
 */
export type TrainingManualEntry = Omit<
  AgriculturalKnowledgeEntry,
  "source" | "pesticide"
> & {
  source: TrainingManualProvenance;
  pesticide: TrainingManualPesticideDetails | null;
};

// ---------------------------------------------------------------------------
// Provenance stamp
// ---------------------------------------------------------------------------

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}(T.*)?$/;

/** Input for buildManualProvenance. */
export type BuildManualProvenanceInput = {
  /**
   * Exact page number in the training manual.
   * Mandatory — source-page traceability must stay intact for every entry.
   */
  sourcePage: number;
  /** Section/chapter title on that page, when the manual provides one. */
  sourceTitle?: string | null;
  /** Publication date of the manual, ISO-8601. Null when unknown. */
  sourceDate?: string | null;
  /** Date the content was extracted/ingested from the manual, ISO-8601. */
  retrievedAt: string;
  /** Qualitative confidence in this specific entry. Defaults to "low". */
  confidence?: "high" | "medium" | "low";
};

/**
 * Stamps an entry's provenance with the fixed Phase 2A training-manual rules.
 *
 * Using this helper is the recommended way to build `source` for every
 * ingested entry: it makes it impossible to accidentally record the wrong
 * source type, tier, verification status, or document identifier, and it
 * refuses to run without an exact page number.
 */
export function buildManualProvenance(
  input: BuildManualProvenanceInput,
): TrainingManualProvenance {
  if (!Number.isInteger(input.sourcePage) || input.sourcePage < 1) {
    throw new RangeError(
      `Training-manual provenance requires an exact positive integer page number (received: ${input.sourcePage}). Source-page traceability is mandatory.`,
    );
  }
  if (!ISO_DATE_PATTERN.test(input.retrievedAt)) {
    throw new RangeError(
      `retrievedAt must be an ISO-8601 date string (received: "${input.retrievedAt}").`,
    );
  }
  if (input.sourceDate != null && !ISO_DATE_PATTERN.test(input.sourceDate)) {
    throw new RangeError(
      `sourceDate must be null or an ISO-8601 date string (received: "${input.sourceDate}").`,
    );
  }

  return {
    sourceType: TRAINING_MANUAL_SOURCE_TYPE,
    sourceTier: TRAINING_MANUAL_SOURCE_TIER,
    sourceTitle: input.sourceTitle ?? null,
    // The training manual is an offline document; it has no source URL.
    sourceUrl: null,
    sourceDocument: TRAINING_MANUAL_SOURCE_DOCUMENT,
    sourcePage: input.sourcePage,
    sourceDate: input.sourceDate ?? null,
    retrievedAt: input.retrievedAt,
    verificationStatus: TRAINING_MANUAL_VERIFICATION_STATUS,
    confidence: input.confidence ?? "low",
  };
}
