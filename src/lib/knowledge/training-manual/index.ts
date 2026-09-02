/**
 * Training-Manual Knowledge Dataset — Public API (Phase 2A)
 *
 * Server-only module. Do not import from client components.
 *
 * ============================================================================
 * TRAINING MANUAL DATA IS NON-ACTIONABLE FOR PESTICIDE RECOMMENDATIONS
 * UNTIL CROSS-VERIFIED AGAINST CURRENT TIER 1/2 SOURCES.
 * ============================================================================
 *
 * Structured dataset ingested from the government-related agricultural
 * training manual. Phase 2A scope:
 *   - entry contract + provenance stamp (compile-time Phase 2A source rules)
 *   - the dataset itself (ingested strictly from the user-provided manual)
 *   - deterministic query helpers (crop / problem / aliases / keywords)
 *   - dataset invariants validation
 *
 * NOT in Phase 2A scope: website scraping, Gemini retrieval wiring, and any
 * Supabase schema changes.
 */

export {
  TRAINING_MANUAL_SOURCE_DOCUMENT,
  TRAINING_MANUAL_SOURCE_TYPE,
  TRAINING_MANUAL_SOURCE_TIER,
  TRAINING_MANUAL_VERIFICATION_STATUS,
  buildManualProvenance,
} from "./types";

export type {
  BuildManualProvenanceInput,
  TrainingManualEntry,
  TrainingManualPesticideDetails,
  TrainingManualProvenance,
} from "./types";

export { TRAINING_MANUAL_ENTRIES } from "./dataset";

export {
  findManualEntriesByCrop,
  findManualEntriesByProblem,
  getManualEntryById,
  listManualCrops,
  searchManualEntries,
} from "./query";

export { validateTrainingManualDataset } from "./validate";

export type {
  ManualDatasetIssue,
  ManualDatasetValidation,
} from "./validate";
