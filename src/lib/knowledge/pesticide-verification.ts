/**
 * Agricultural Knowledge Layer — Pesticide Verification & Safety Rules
 *
 * Enforces the core safety rule:
 *
 *   A pesticide recommendation must NOT be considered actionable unless
 *   ALL of the following are explicitly verified:
 *
 *     - active ingredient
 *     - application rate
 *     - target crop/use
 *     - target pest/disease/problem
 *     - current registration/authorisation for the intended use
 *     - source provenance
 *     - source date or retrieval date
 *
 * The system distinguishes:
 *
 *   A. General agronomic information
 *      (symptoms, scouting, cultural management, IPM, prevention)
 *      — may be shared when the source is credible.
 *
 *   B. Actionable pesticide information
 *      (active ingredient, dose/rate, registration, PHI, REI)
 *      — requires the strongest verification before recommendation.
 *
 * KEY SAFETY RULES:
 *
 *   - Product name is optional (government guidance may identify an active
 *     ingredient rather than a commercial brand).
 *   - registrationStatus = confirmed_current is the ONLY value that passes
 *     the registration gate. All other values fail.
 *   - Manufacturer presence alone is NOT registration approval.
 *   - Training-manual entries always fail actionable pesticide verification
 *     until separately cross-verified against current Tier 1/2 evidence.
 *   - Commercial-catalog entries never independently pass actionable
 *     verification.
 *   - PHI and REI must never be invented by the AI. When missing from the
 *     source, the entry explicitly states they are unavailable or unverified.
 *
 * Server-only module. Do not import from client components.
 */

import type {
  AgriculturalKnowledgeEntry,
  ContentClassification,
  PesticideDetails,
  RegistrationStatus,
  VerificationStatus,
} from "./types";

// ---------------------------------------------------------------------------
// Verification thresholds
// ---------------------------------------------------------------------------

/**
 * Verification statuses that are sufficient for actionable pesticide
 * recommendations. Only verified_current passes.
 */
const ACTIONABLE_VERIFICATION: ReadonlySet<VerificationStatus> = new Set([
  "verified_current",
]);

/**
 * The only registration status that permits actionable pesticide guidance.
 */
const ACTIONABLE_REGISTRATION: RegistrationStatus = "confirmed_current";

/**
 * Maximum source tier (i.e. lowest authority) that may independently
 * support an actionable pesticide recommendation.
 *
 * Tier 1 = Punjab Government
 * Tier 2 = Manufacturer
 *
 * Tier 3 (training_manual) and Tier 4 (commercial_catalog) are hard-blocked
 * from independent actionable pesticide recommendations regardless of
 * verification status, because:
 *
 *   1. Training manuals may contain outdated pesticide registration data.
 *   2. Pesticide registrations change — products may be banned, restricted,
 *      or re-classified after a manual was published.
 *   3. Commercial catalogs reflect product availability, not regulatory
 *      approval status.
 */
const MAX_TIER_FOR_PESTICIDE_ACTION = 2 as const;

// ---------------------------------------------------------------------------
// Content classification
// ---------------------------------------------------------------------------

/**
 * Classifies a knowledge entry as either general agronomic information
 * or actionable pesticide information.
 *
 * An entry is classified as "actionable_pesticide" when it carries
 * non-null pesticide details with at least one pesticide-specific field
 * populated. Everything else is "general_agronomy".
 */
export function classifyContent(
  entry: AgriculturalKnowledgeEntry,
): ContentClassification {
  if (entry.pesticide !== null && hasAnyPesticideField(entry.pesticide)) {
    return "actionable_pesticide";
  }
  return "general_agronomy";
}

/**
 * Returns true when at least one pesticide-specific field is populated.
 */
function hasAnyPesticideField(p: PesticideDetails): boolean {
  return (
    p.productName !== null ||
    p.activeIngredient !== null ||
    p.formulation !== null ||
    p.applicationRate !== null ||
    p.phi.status !== "unverified" ||
    p.rei.status !== "unverified" ||
    p.safetyNotes !== null ||
    p.registrationStatus !== "unknown"
  );
}

// ---------------------------------------------------------------------------
// Detailed verification result
// ---------------------------------------------------------------------------

/**
 * Result of a detailed pesticide verification check.
 *
 * - actionable: true only when every gate passes.
 * - reasons: one string per gate, explaining pass or fail.
 */
export type PesticideVerificationResult = {
  actionable: boolean;
  reasons: string[];
};

// ---------------------------------------------------------------------------
// Core verification function (boolean)
// ---------------------------------------------------------------------------

/**
 * Determines whether a knowledge entry's pesticide information is
 * sufficiently verified to be used in an actionable recommendation.
 *
 * Thin wrapper around explainPesticideVerification for callers that
 * only need a boolean.
 */
export function isPesticideRecommendationVerified(
  entry: AgriculturalKnowledgeEntry,
): boolean {
  return explainPesticideVerification(entry).actionable;
}

// ---------------------------------------------------------------------------
// Detailed verification function (with reasons)
// ---------------------------------------------------------------------------

/**
 * Performs a detailed pesticide verification check against every gate
 * and returns the result with individual pass/fail reasons.
 *
 * Gates (all must pass for actionable = true):
 *
 *   1. Pesticide details present
 *   2. Source provenance exists (sourceType present)
 *   3. Temporal anchoring (sourceDate or retrievedAt present)
 *   4. Source tier ≤ 2 (training-manual and commercial-catalog hard-blocked)
 *   5. Verification status = verified_current
 *   6. Active ingredient present
 *   7. Application rate present
 *   8. Target crop present
 *   9. Target pest/disease/problem present
 *  10. Registration status = confirmed_current
 *  11. PHI not unverified (available or explicitly not_available_from_source)
 *  12. REI not unverified (available or explicitly not_available_from_source)
 */
export function explainPesticideVerification(
  entry: AgriculturalKnowledgeEntry,
): PesticideVerificationResult {
  const reasons: string[] = [];
  let actionable = true;

  const { pesticide, source } = entry;

  // -- Gate 1: Pesticide data present ----------------------------------------
  if (pesticide === null) {
    return {
      actionable: false,
      reasons: ["No pesticide details present — entry is not actionable."],
    };
  }

  // -- Gate 2: Source provenance ----------------------------------------------
  if (!source.sourceType) {
    reasons.push("Source provenance missing: sourceType not set.");
    actionable = false;
  }

  // -- Gate 3: Temporal anchoring ---------------------------------------------
  if (source.sourceDate === null && source.retrievedAt === null) {
    reasons.push(
      "No temporal anchor: both sourceDate and retrievedAt are missing.",
    );
    actionable = false;
  }

  // -- Gate 4: Source tier ----------------------------------------------------
  if (source.sourceTier > MAX_TIER_FOR_PESTICIDE_ACTION) {
    const tierLabel =
      source.sourceTier === 3
        ? "training_manual"
        : source.sourceTier === 4
          ? "commercial_catalog"
          : `tier ${source.sourceTier}`;
    reasons.push(
      `Source tier ${source.sourceTier} (${tierLabel}) cannot independently support actionable pesticide recommendations. Maximum allowed tier: ${MAX_TIER_FOR_PESTICIDE_ACTION}.`,
    );
    actionable = false;
  }

  // -- Gate 5: Verification status --------------------------------------------
  if (!ACTIONABLE_VERIFICATION.has(source.verificationStatus)) {
    reasons.push(
      `Verification status "${source.verificationStatus}" is insufficient. Required: verified_current.`,
    );
    actionable = false;
  }

  // -- Gate 6: Active ingredient ----------------------------------------------
  if (pesticide.activeIngredient === null) {
    reasons.push("Active ingredient not provided.");
    actionable = false;
  }

  // -- Gate 7: Application rate -----------------------------------------------
  if (pesticide.applicationRate === null) {
    reasons.push("Application rate unavailable.");
    actionable = false;
  }

  // -- Gate 8: Target crop ----------------------------------------------------
  if (!entry.crop || entry.crop.trim() === "") {
    reasons.push("Target crop not specified.");
    actionable = false;
  }

  // -- Gate 9: Target pest/disease/problem ------------------------------------
  if (!entry.problemName || entry.problemName.trim() === "") {
    reasons.push("Target pest/disease/problem not specified.");
    actionable = false;
  }

  // -- Gate 10: Registration status -------------------------------------------
  if (pesticide.registrationStatus !== ACTIONABLE_REGISTRATION) {
    reasons.push(
      `Current registration not verified: registrationStatus is "${pesticide.registrationStatus}". Only "${ACTIONABLE_REGISTRATION}" permits actionable guidance.`,
    );
    actionable = false;
  }

  // -- Gate 11: PHI not unverified --------------------------------------------
  if (pesticide.phi.status === "unverified") {
    reasons.push(
      "PHI is unverified — must be confirmed as available or explicitly unavailable from source.",
    );
    actionable = false;
  }

  // -- Gate 12: REI not unverified --------------------------------------------
  if (pesticide.rei.status === "unverified") {
    reasons.push(
      "REI is unverified — must be confirmed as available or explicitly unavailable from source.",
    );
    actionable = false;
  }

  // -- Summary ----------------------------------------------------------------
  if (actionable) {
    reasons.push(
      "All pesticide verification gates passed. Entry may be used in actionable recommendations.",
    );
  }

  return { actionable, reasons };
}

// ---------------------------------------------------------------------------
// Safety gate for the AI layer — general agronomy
// ---------------------------------------------------------------------------

/**
 * Returns true when general agronomic content from the entry may be
 * shared with the farmer. This is less restrictive than pesticide
 * verification — general agronomy from any verified or source-verified
 * entry is considered safe to share.
 */
export function isGeneralAgronomySafe(
  entry: AgriculturalKnowledgeEntry,
): boolean {
  const status = entry.source.verificationStatus;
  return status === "verified_current" || status === "verified_source_only";
}
