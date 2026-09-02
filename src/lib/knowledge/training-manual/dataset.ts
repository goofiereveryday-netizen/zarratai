/**
 * Training-Manual Knowledge Dataset — Phase 2A
 *
 * Server-only module. Do not import from client components.
 *
 * ============================================================================
 * TRAINING MANUAL DATA IS NON-ACTIONABLE FOR PESTICIDE RECOMMENDATIONS
 * UNTIL CROSS-VERIFIED AGAINST CURRENT TIER 1/2 SOURCES.
 * ============================================================================
 *
 * INGESTION STATUS: awaiting the user-provided manual content.
 *
 * Project decision for Phase 2A: entries in this dataset are ingested
 * STRICTLY from the user's government-related agricultural training manual.
 * No entries are drafted from memory, and no page numbers are invented —
 * every `sourcePage` must be the exact page the content was read from.
 *
 * When the manual content is provided, add entries to TRAINING_MANUAL_ENTRIES
 * following the template at the bottom of this file and these rules:
 *
 *   1. Build provenance with buildManualProvenance({ sourcePage, retrievedAt })
 *      so every entry is stamped sourceType="training_manual", sourceTier=3,
 *      verificationStatus="requires_current_verification", and the
 *      dataset-wide sourceDocument identifier.
 *
 *   2. GENERAL AGRONOMY goes in the dedicated fields (symptoms,
 *      scoutingGuidance, economicThreshold, culturalManagement,
 *      biologicalManagement, preventiveManagement), recorded exactly as the
 *      manual states it. Use null when the manual does not state a value —
 *      never fill gaps from memory.
 *
 *   3. PESTICIDE-SPECIFIC information may be recorded only when the manual
 *      explicitly states it, and it must remain non-actionable:
 *        - never upgrade to verified_current / confirmed_current
 *        - never infer missing PHI/REI (use not_available_from_source)
 *        - never invent dosage, formulation, or registration details
 *      Old pesticide/product information from the manual is preserved as
 *      source-derived historical/reference information only, with
 *      registrationStatus "requires_verification" or "unknown".
 *
 *   4. First batch target: ~15–25 representative entries across wheat,
 *      cotton, rice, sugarcane, maize, potato, vegetables, and citrus/mango —
 *      not the entire book. Prefer representative coverage across multiple
 *      crops and problem types.
 *
 *   5. After every ingestion, run validateTrainingManualDataset() from
 *      ./validate to confirm the invariants still hold.
 */

import type { TrainingManualEntry } from "./types";

/**
 * Phase 2A training-manual dataset.
 *
 * EMPTY until the user-provided manual content is ingested. Every future
 * entry must cite the exact manual page it was extracted from.
 */
export const TRAINING_MANUAL_ENTRIES: readonly TrainingManualEntry[] = [];

// ---------------------------------------------------------------------------
// ENTRY TEMPLATE — for ingestion only. Do NOT commit placeholder data.
//
// {
//   id: "tm-wheat-001",
//   crop: "wheat",
//   problemType: "disease", // pest | disease | weed | nutrient_deficiency | physiological | other
//   problemName: "<exact problem name as the manual states it>",
//   aliases: ["<alternative/local names listed in the manual>"],
//   symptoms: ["<symptoms exactly as the manual describes them>"],
//   scoutingGuidance: "<scouting/monitoring guidance from the manual page>",
//   economicThreshold: "<threshold as stated by the manual>",
//   culturalManagement: "<cultural management from the manual>",
//   biologicalManagement: "<biological management from the manual>",
//   preventiveManagement: "<preventive management from the manual>",
//   chemicalManagement: "<general chemical guidance as stated by the manual>",
//   pesticide: {
//     // ONLY record what the manual explicitly states. Never infer PHI/REI,
//     // never invent dosage or registration details.
//     productName: "<product name as printed in the manual>",
//     activeIngredient: "<active ingredient as printed in the manual>",
//     formulation: "<formulation code as printed in the manual>",
//     applicationRate: "<rate exactly as printed, with units>",
//     phi: { status: "not_available_from_source" }, // { status: "available", value: <days> } ONLY if the manual states it
//     rei: { status: "not_available_from_source" }, // { status: "available", value: "<interval>" } ONLY if the manual states it
//     safetyNotes: "<safety text from the manual>",
//     registrationStatus: "requires_verification", // or "unknown" — NEVER "confirmed_current"
//   },
//   source: buildManualProvenance({
//     sourcePage: <exact page number in the manual>,
//     retrievedAt: "<ingestion date, ISO-8601>",
//   }),
// }
// ---------------------------------------------------------------------------
