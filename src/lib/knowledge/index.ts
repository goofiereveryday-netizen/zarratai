/**
 * Agricultural Knowledge Layer — Public API
 *
 * Barrel export for the knowledge module and a small set of clearly labelled
 * test fixtures that demonstrate the schema and verification rules.
 *
 * Server-only module. Do not import from client components.
 */

// ---------------------------------------------------------------------------
// Re-exports
// ---------------------------------------------------------------------------

export type {
  AgriculturalKnowledgeEntry,
  KnowledgeSourceType,
  SourceTier,
  VerificationStatus,
  ProblemType,
  PesticideDetails,
  SourceProvenance,
  ContentClassification,
  RegistrationStatus,
  PhiAvailability,
  ReiAvailability,
} from "./types";

export {
  SOURCE_TIER,
  SOURCE_LABEL,
  getSourceTier,
  isHigherPriority,
  compareBySourcePriority,
  highestTierEntries,
  hasTierConflict,
} from "./source-priority";

export {
  classifyContent,
  isPesticideRecommendationVerified,
  isGeneralAgronomySafe,
  explainPesticideVerification,
} from "./pesticide-verification";

export type { PesticideVerificationResult } from "./pesticide-verification";

export {
  TRAINING_MANUAL_ENTRIES,
  TRAINING_MANUAL_SOURCE_DOCUMENT,
  TRAINING_MANUAL_SOURCE_TYPE,
  TRAINING_MANUAL_SOURCE_TIER,
  TRAINING_MANUAL_VERIFICATION_STATUS,
  buildManualProvenance,
  findManualEntriesByCrop,
  findManualEntriesByProblem,
  getManualEntryById,
  listManualCrops,
  searchManualEntries,
  validateTrainingManualDataset,
} from "./training-manual";

export type {
  BuildManualProvenanceInput,
  ManualDatasetIssue,
  ManualDatasetValidation,
  TrainingManualEntry,
  TrainingManualPesticideDetails,
  TrainingManualProvenance,
} from "./training-manual";

// ---------------------------------------------------------------------------
// Test fixtures
//
// These exist ONLY to demonstrate the schema and exercise the verification
// helpers during development. They do NOT contain real pesticide doses,
// real registration data, or fabricated product information.
// ---------------------------------------------------------------------------

import type { AgriculturalKnowledgeEntry } from "./types";

/**
 * Fixture 1 — Government / general agronomy evidence.
 *
 * Represents a Punjab Agriculture Department advisory on wheat yellow rust.
 * Classified as general agronomy: symptoms, scouting, and cultural management.
 * No pesticide details, so isPesticideRecommendationVerified → false.
 */
export const FIXTURE_GOVERNMENT_AGRONOMY: AgriculturalKnowledgeEntry = {
  id: "fixture-gov-001",
  crop: "wheat",
  problemType: "disease",
  problemName: "Yellow Rust",
  aliases: ["Stripe Rust", "Pili Kutai"],
  symptoms: [
    "Yellow-orange pustules in stripes along leaf veins",
    "Severe infection leads to premature leaf drying",
  ],
  scoutingGuidance:
    "Inspect lower leaves of wheat crop weekly from tillering to grain-filling stage. Look for characteristic stripe pattern.",
  economicThreshold:
    "Action recommended when disease is observed on flag leaf or upper two leaves during boot to heading stage.",
  culturalManagement:
    "Plant resistant varieties. Avoid late sowing. Balanced use of nitrogen fertilizer — excessive nitrogen increases susceptibility.",
  biologicalManagement: null,
  preventiveManagement:
    "Use certified seed of resistant varieties. Monitor early-sown fields first.",
  chemicalManagement: null,
  pesticide: null,
  source: {
    sourceType: "punjab_government",
    sourceTier: 1,
    sourceTitle: "Wheat Crop Advisory — Rabi Season",
    sourceUrl: "https://agripunjab.gov.pk/",
    sourceDocument: null,
    sourcePage: null,
    sourceDate: null,
    retrievedAt: "2026-09-03T00:00:00.000Z",
    verificationStatus: "verified_current",
    confidence: "high",
  },
};

/**
 * Fixture 2 — Training-manual evidence requiring current verification.
 *
 * Represents information extracted from a government-related pesticide
 * training manual. Contains pesticide fields but is classified as
 * "requires_current_verification" because:
 *
 *   1. The manual may pre-date current pesticide registrations.
 *   2. Pesticide approvals change — products may have been banned,
 *      restricted, or re-classified since the manual was published.
 *   3. The source tier is 3, which is above the maximum allowed tier
 *      for independent actionable pesticide recommendations.
 *
 * isPesticideRecommendationVerified → false (tier too low + not verified_current).
 */
export const FIXTURE_TRAINING_MANUAL_PESTICIDE: AgriculturalKnowledgeEntry = {
  id: "fixture-manual-001",
  crop: "cotton",
  problemType: "pest",
  problemName: "Cotton Bollworm",
  aliases: ["American Bollworm", "Helicoverpa armigera"],
  symptoms: [
    "Bore holes into bolls with frass visible at entry point",
    "Damaged bolls may show premature opening or rotting",
  ],
  scoutingGuidance:
    "Count larvae per plant. Sample 5 plants at 10 random locations per hectare.",
  economicThreshold:
    "1–2 larvae per plant during boll development stage.",
  culturalManagement:
    "Destroy crop residues after harvest. Use pheromone traps for monitoring.",
  biologicalManagement:
    "Conserve natural enemies — Trichogramma wasps, predatory beetles.",
  preventiveManagement:
    "Early sowing to avoid peak bollworm incidence period.",
  chemicalManagement:
    "Training manual reference to chemical control when threshold is exceeded. Specific product details are illustrative only and require current verification.",
  pesticide: {
    productName: "EXAMPLE-PRODUCT (not a real product)",
    activeIngredient: "example-active-ingredient",
    formulation: "EC",
    applicationRate: "see-label (not a real rate)",
    phi: { status: "unverified" },
    rei: { status: "unverified" },
    safetyNotes: "This is a fixture entry. Do not use real pesticide data from training manuals without current verification.",
    registrationStatus: "unknown",
  },
  source: {
    sourceType: "training_manual",
    sourceTier: 3,
    sourceTitle: "Pesticide Training Manual (Example)",
    sourceUrl: null,
    sourceDocument: "pesticide-training-manual.pdf",
    sourcePage: 42,
    sourceDate: null,
    retrievedAt: "2026-09-03T00:00:00.000Z",
    verificationStatus: "requires_current_verification",
    confidence: "low",
  },
};

/**
 * Fixture 3 — Manufacturer evidence.
 *
 * Represents product-label information from a manufacturer source.
 * Tier 2 + verified_current would pass isPesticideRecommendationVerified,
 * but this fixture intentionally omits applicationRate so the check
 * returns false — demonstrating that even high-tier entries require
 * complete critical fields.
 */
export const FIXTURE_MANUFACTURER_EVIDENCE: AgriculturalKnowledgeEntry = {
  id: "fixture-mfr-001",
  crop: "rice",
  problemType: "pest",
  problemName: "Stem Borer",
  aliases: ["Yellow Stem Borer", "Scirpophaga incertulas"],
  symptoms: [
    "Dead hearts in vegetative stage",
    "White heads at panicle stage",
  ],
  scoutingGuidance:
    "Check for dead hearts and moth activity in the evening. Use light traps for monitoring.",
  economicThreshold:
    "5% dead hearts or 1 egg mass per square meter.",
  culturalManagement:
    "Clip and destroy seedling tips before transplanting to remove eggs. Drain field periodically.",
  biologicalManagement: null,
  preventiveManagement:
    "Use resistant varieties where available. Synchronize planting in the area.",
  chemicalManagement:
    "Manufacturer product label reference. Application rate intentionally omitted in this fixture.",
  pesticide: {
    productName: "EXAMPLE-MFR-PRODUCT (not a real product)",
    activeIngredient: "example-active-ingredient",
    formulation: "GR",
    applicationRate: null,
    phi: { status: "unverified" },
    rei: { status: "unverified" },
    safetyNotes: "This is a fixture entry demonstrating a manufacturer source with incomplete pesticide fields.",
    registrationStatus: "unknown",
  },
  source: {
    sourceType: "manufacturer",
    sourceTier: 2,
    sourceTitle: "Example Manufacturer Product Page",
    sourceUrl: "https://www.syngenta.com.pk/",
    sourceDocument: null,
    sourcePage: null,
    sourceDate: null,
    retrievedAt: "2026-09-03T00:00:00.000Z",
    verificationStatus: "verified_current",
    confidence: "medium",
  },
};

/**
 * Fixture 4 — Synthetic entry that passes ALL actionable pesticide gates.
 *
 * This fixture is clearly marked as synthetic and exists ONLY to verify
 * that the validation function works correctly when every gate is
 * satisfied. It does NOT represent any real pesticide product.
 *
 * isPesticideRecommendationVerified → true.
 */
export const FIXTURE_SYNTHETIC_PASSING: AgriculturalKnowledgeEntry = {
  id: "fixture-synthetic-pass-001",
  crop: "synthetic-crop",
  problemType: "pest",
  problemName: "Synthetic Pest",
  aliases: ["SYN-pest (not real)"],
  symptoms: ["Synthetic symptom A", "Synthetic symptom B"],
  scoutingGuidance: "Synthetic scouting guidance.",
  economicThreshold: "Synthetic threshold.",
  culturalManagement: "Synthetic cultural management.",
  biologicalManagement: null,
  preventiveManagement: null,
  chemicalManagement: "Synthetic chemical management reference.",
  pesticide: {
    productName: "SYNTHETIC-PRODUCT (not a real product)",
    activeIngredient: "synthetic-active",
    formulation: "SC",
    applicationRate: "1 L/ha (synthetic rate)",
    phi: { status: "available", value: 14 },
    rei: { status: "available", value: "24 hours" },
    safetyNotes: "Synthetic safety notes. This fixture must never be used for real recommendations.",
    registrationStatus: "confirmed_current",
  },
  source: {
    sourceType: "punjab_government",
    sourceTier: 1,
    sourceTitle: "Synthetic Government Source (test only)",
    sourceUrl: "https://agripunjab.gov.pk/",
    sourceDocument: null,
    sourcePage: null,
    sourceDate: "2026-09-01",
    retrievedAt: "2026-09-03T00:00:00.000Z",
    verificationStatus: "verified_current",
    confidence: "high",
  },
};

/**
 * All test fixtures collected for easy iteration in development tools.
 */
export const TEST_FIXTURES: readonly AgriculturalKnowledgeEntry[] = [
  FIXTURE_GOVERNMENT_AGRONOMY,
  FIXTURE_TRAINING_MANUAL_PESTICIDE,
  FIXTURE_MANUFACTURER_EVIDENCE,
  FIXTURE_SYNTHETIC_PASSING,
];
