/**
 * Training-Manual Dataset — Invariants Validation (Phase 2A)
 *
 * Server-only module. Do not import from client components.
 *
 * ============================================================================
 * TRAINING MANUAL DATA IS NON-ACTIONABLE FOR PESTICIDE RECOMMENDATIONS
 * UNTIL CROSS-VERIFIED AGAINST CURRENT TIER 1/2 SOURCES.
 * ============================================================================
 *
 * The project has no test framework, so dataset integrity is guarded by this
 * lightweight pure validation function. Run it during ingestion review and
 * from dev tooling:
 *
 *   const result = validateTrainingManualDataset();
 *   if (!result.ok) console.error(result.issues);
 *
 * An empty dataset is considered structurally valid (ok: true,
 * entryCount: 0) — Phase 2A infrastructure precedes manual ingestion.
 *
 * These checks enforce the Phase 2A source rules at runtime for any entry
 * that reaches the dataset (e.g. one constructed outside the narrowed
 * TrainingManualEntry type or loaded dynamically later):
 *   - fixed training-manual provenance (type, tier, document, page)
 *   - verificationStatus is never upgraded past requires_current_verification
 *   - pesticide registrationStatus is never confirmed_current (and never a
 *     definitive negative claim) — only "requires_verification" | "unknown"
 */

import type { AgriculturalKnowledgeEntry } from "../types";
import { classifyContent } from "../pesticide-verification";
import { TRAINING_MANUAL_ENTRIES } from "./dataset";
import {
  TRAINING_MANUAL_SOURCE_DOCUMENT,
  TRAINING_MANUAL_SOURCE_TIER,
  TRAINING_MANUAL_SOURCE_TYPE,
  TRAINING_MANUAL_VERIFICATION_STATUS,
} from "./types";

// ---------------------------------------------------------------------------
// Result types
// ---------------------------------------------------------------------------

/** One rule violation found in the dataset. */
export type ManualDatasetIssue = {
  /** Id of the offending entry, or null when the entry has no usable id. */
  entryId: string | null;
  /** Stable rule code, e.g. "MANUAL_SOURCE_PAGE". */
  rule: string;
  /** Human-readable explanation of the violation. */
  message: string;
};

/** Aggregate validation result for the dataset. */
export type ManualDatasetValidation = {
  /** True only when no issues were found. */
  ok: boolean;
  /** Number of entries checked. */
  entryCount: number;
  /** All rule violations, in check order. */
  issues: ManualDatasetIssue[];
};

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}(T.*)?$/;

/**
 * The only registration statuses a training manual may record. A dated
 * manual can never establish current registration ("confirmed_current"),
 * nor definitively prove expiry/withdrawal/non-registration — those claims
 * require current official Tier 1/2 records.
 */
const ALLOWED_MANUAL_REGISTRATION_STATUSES: ReadonlySet<string> = new Set([
  "requires_verification",
  "unknown",
]);

function keyOf(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function pushIssue(
  issues: ManualDatasetIssue[],
  entryId: string | null,
  rule: string,
  message: string,
): void {
  issues.push({ entryId, rule, message });
}

/**
 * Validates the training-manual dataset (or any candidate entry list)
 * against the Phase 2A invariants.
 */
export function validateTrainingManualDataset(
  entries: readonly AgriculturalKnowledgeEntry[] = TRAINING_MANUAL_ENTRIES,
): ManualDatasetValidation {
  const issues: ManualDatasetIssue[] = [];
  const seenIds = new Set<string>();
  const seenCropProblems = new Set<string>();

  for (const entry of entries) {
    const entryId = entry.id && entry.id.trim() !== "" ? entry.id : null;

    // -- Identity ---------------------------------------------------------------
    if (entryId === null) {
      pushIssue(
        issues,
        null,
        "MANUAL_ID_REQUIRED",
        "Entry has no usable id. Every training-manual entry needs a stable ingestion-assigned id.",
      );
    } else if (seenIds.has(entryId)) {
      pushIssue(
        issues,
        entryId,
        "MANUAL_ID_UNIQUE",
        `Duplicate entry id "${entryId}".`,
      );
    } else {
      seenIds.add(entryId);
    }

    // -- Crop / problem ---------------------------------------------------------
    if (!entry.crop || entry.crop.trim() === "") {
      pushIssue(
        issues,
        entryId,
        "MANUAL_CROP_REQUIRED",
        "Entry has no crop. Retrieval by crop requires a crop on every entry.",
      );
    }
    if (!entry.problemName || entry.problemName.trim() === "") {
      pushIssue(
        issues,
        entryId,
        "MANUAL_PROBLEM_REQUIRED",
        "Entry has no problemName.",
      );
    }

    const cropProblemKey = `${keyOf(entry.crop)}::${keyOf(entry.problemName)}`;
    if (cropProblemKey !== "::") {
      if (seenCropProblems.has(cropProblemKey)) {
        pushIssue(
          issues,
          entryId,
          "MANUAL_DUPLICATE_PROBLEM",
          `Duplicate crop+problem combination "${entry.crop} / ${entry.problemName}". Enrich the existing entry instead of adding a second record for the same crop × problem.`,
        );
      } else {
        seenCropProblems.add(cropProblemKey);
      }
    }

    // -- Provenance invariants --------------------------------------------------
    const { source } = entry;

    if (source.sourceType !== TRAINING_MANUAL_SOURCE_TYPE) {
      pushIssue(
        issues,
        entryId,
        "MANUAL_SOURCE_TYPE",
        `sourceType must be "${TRAINING_MANUAL_SOURCE_TYPE}" for every training-manual entry (found: "${source.sourceType}").`,
      );
    }

    if (source.sourceTier !== TRAINING_MANUAL_SOURCE_TIER) {
      pushIssue(
        issues,
        entryId,
        "MANUAL_SOURCE_TIER",
        `sourceTier must be ${TRAINING_MANUAL_SOURCE_TIER} for every training-manual entry (found: ${source.sourceTier}).`,
      );
    }

    if (source.sourceDocument !== TRAINING_MANUAL_SOURCE_DOCUMENT) {
      pushIssue(
        issues,
        entryId,
        "MANUAL_SOURCE_DOCUMENT",
        `sourceDocument must be the dataset-wide identifier "${TRAINING_MANUAL_SOURCE_DOCUMENT}" (found: ${JSON.stringify(source.sourceDocument)}).`,
      );
    }

    if (
      source.sourcePage === null ||
      !Number.isInteger(source.sourcePage) ||
      source.sourcePage < 1
    ) {
      pushIssue(
        issues,
        entryId,
        "MANUAL_SOURCE_PAGE",
        `sourcePage must be an exact positive integer page number (found: ${JSON.stringify(source.sourcePage)}). Source-page traceability is mandatory for every entry.`,
      );
    }

    if (source.sourceDate !== null && !ISO_DATE_PATTERN.test(source.sourceDate)) {
      pushIssue(
        issues,
        entryId,
        "MANUAL_SOURCE_DATE_FORMAT",
        `sourceDate must be null (unknown) or an ISO-8601 date string (found: ${JSON.stringify(source.sourceDate)}).`,
      );
    }

    if (source.verificationStatus !== TRAINING_MANUAL_VERIFICATION_STATUS) {
      pushIssue(
        issues,
        entryId,
        "MANUAL_VERIFICATION_STATUS",
        `verificationStatus must be "${TRAINING_MANUAL_VERIFICATION_STATUS}" — training-manual data is never "verified_current" on its own (found: "${source.verificationStatus}").`,
      );
    }

    if (source.retrievedAt === null || source.retrievedAt.trim() === "") {
      pushIssue(
        issues,
        entryId,
        "MANUAL_RETRIEVED_AT",
        "retrievedAt (ingestion date) is required so provenance records when the content was extracted from the manual.",
      );
    }

    // -- Pesticide invariants ---------------------------------------------------
    if (entry.pesticide !== null) {
      if (
        !ALLOWED_MANUAL_REGISTRATION_STATUSES.has(
          entry.pesticide.registrationStatus,
        )
      ) {
        pushIssue(
          issues,
          entryId,
          "MANUAL_REGISTRATION_STATUS",
          `pesticide.registrationStatus must be "requires_verification" or "unknown" for training-manual data (found: "${entry.pesticide.registrationStatus}"). A dated manual can never establish current registration or prove expiry/withdrawal — only cross-verification against current Tier 1/2 sources may set another status.`,
        );
      }

      if (classifyContent(entry) === "general_agronomy") {
        pushIssue(
          issues,
          entryId,
          "MANUAL_PESTICIDE_MEANINGFUL",
          "pesticide is non-null but carries no pesticide-specific data. Either record the pesticide information the manual actually states, or set pesticide to null.",
        );
      }
    }
  }

  return {
    ok: issues.length === 0,
    entryCount: entries.length,
    issues,
  };
}
