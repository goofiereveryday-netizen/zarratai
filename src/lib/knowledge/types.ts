/**
 * Agricultural Knowledge Layer — Type Definitions
 *
 * Server-only module. Do not import from client components.
 *
 * This schema represents verified agricultural knowledge entries
 * sourced from government, manufacturer, training, and commercial
 * sources with explicit provenance and verification metadata.
 */

// ---------------------------------------------------------------------------
// Source classification
// ---------------------------------------------------------------------------

/**
 * Distinguishes where a piece of knowledge originated.
 *
 * Priority order (highest → lowest):
 *   punjab_government > manufacturer > training_manual > commercial_catalog
 */
export type KnowledgeSourceType =
  | "punjab_government"
  | "manufacturer"
  | "training_manual"
  | "commercial_catalog";

/**
 * Numeric tier matching the source priority rules.
 * Tier 1 = highest authority.
 */
export type SourceTier = 1 | 2 | 3 | 4;

// ---------------------------------------------------------------------------
// Verification status
// ---------------------------------------------------------------------------

/**
 * Indicates how current and trustworthy the entry is.
 *
 * - verified_current:
 *     Confirmed against the latest available version of the source.
 * - verified_source_only:
 *     The source itself is authoritative, but the entry has not been
 *     re-confirmed against the most recent publication/date.
 * - requires_current_verification:
 *     The entry was extracted from a source that may be dated;
 *     it must be cross-checked before use in actionable recommendations.
 * - unverified:
 *     No verification has been performed yet.
 */
export type VerificationStatus =
  | "verified_current"
  | "verified_source_only"
  | "requires_current_verification"
  | "unverified";

// ---------------------------------------------------------------------------
// Problem classification
// ---------------------------------------------------------------------------

/**
 * Broad category of the agricultural problem described.
 */
export type ProblemType =
  | "pest"
  | "disease"
  | "weed"
  | "nutrient_deficiency"
  | "physiological"
  | "other";

// ---------------------------------------------------------------------------
// Registration status
// ---------------------------------------------------------------------------

/**
 * Strict registration/authorisation status of a pesticide product
 * for its intended crop/use.
 *
 * Only `confirmed_current` may pass the actionable-pesticide gate.
 * All other values are non-actionable:
 *
 * - requires_verification:
 *     Registration information was found but has not been confirmed
 *     against current official records.
 * - unknown:
 *     The source did not provide any registration information.
 * - expired_or_withdrawn:
 *     The product registration has lapsed or been withdrawn.
 * - not_registered:
 *     The product is not registered for this use.
 *
 * IMPORTANT: `confirmed_current` must only be set when the ingested
 * evidence EXPLICITLY supports current authorisation/registration
 * for the intended crop and use. It must NOT be inferred from a
 * product merely appearing on a manufacturer website or in a
 * dated training manual.
 */
export type RegistrationStatus =
  | "confirmed_current"
  | "requires_verification"
  | "unknown"
  | "expired_or_withdrawn"
  | "not_registered";

// ---------------------------------------------------------------------------
// PHI / REI availability
// ---------------------------------------------------------------------------

/**
 * Explicit representation of Pre-Harvest Interval availability.
 *
 * PHI must never be invented by the AI. When a source does not provide
 * a PHI value, the entry must state so explicitly rather than leaving
 * the absence ambiguous.
 *
 * - available: the source provides a concrete PHI value (days).
 * - not_available_from_source: the source genuinely does not state a PHI.
 * - unverified: PHI has not been checked against the source yet.
 */
export type PhiAvailability =
  | { status: "available"; value: number }
  | { status: "not_available_from_source" }
  | { status: "unverified" };

/**
 * Explicit representation of Re-Entry Interval availability.
 *
 * Same rules as PHI — must never be invented, absence must be explicit.
 * REI is stored as a string because sources express it in varied units
 * (e.g. "24 hours", "2 days").
 */
export type ReiAvailability =
  | { status: "available"; value: string }
  | { status: "not_available_from_source" }
  | { status: "unverified" };

// ---------------------------------------------------------------------------
// Pesticide-specific structured fields
// ---------------------------------------------------------------------------

/**
 * Structured pesticide information that may be attached to a knowledge entry.
 *
 * IMPORTANT: These fields must never be fabricated. When the source does not
 * provide a value, leave the field null (or use the explicit availability
 * types for PHI/REI) rather than guess.
 */
export type PesticideDetails = {
  /** Commercial product name as it appears on the label. May be null when
   *  the source identifies an active ingredient rather than a brand. */
  productName: string | null;
  /** Active ingredient(s) — common name, not trade name. */
  activeIngredient: string | null;
  /** Formulation type (e.g. "EC", "WP", "SC", "GR"). */
  formulation: string | null;
  /**
   * Application rate with units, exactly as stated by the source.
   * Example: "500 ml/ha" or "2 ml/L water"
   */
  applicationRate: string | null;
  /**
   * Pre-harvest interval — explicit availability representation.
   * Must never be invented. When missing, the entry states so explicitly.
   */
  phi: PhiAvailability;
  /**
   * Re-entry interval — explicit availability representation.
   * Must never be invented. When missing, the entry states so explicitly.
   */
  rei: ReiAvailability;
  /** Free-text safety notes from the source (PPE, toxicity class, etc.). */
  safetyNotes: string | null;
  /**
   * Strict registration/authorisation status for the intended crop/use.
   * Only `confirmed_current` passes the actionable pesticide gate.
   */
  registrationStatus: RegistrationStatus;
};

// ---------------------------------------------------------------------------
// Source provenance
// ---------------------------------------------------------------------------

/**
 * Full provenance record so downstream consumers can cite the origin of
 * every piece of knowledge presented to a farmer.
 */
export type SourceProvenance = {
  sourceType: KnowledgeSourceType;
  sourceTier: SourceTier;
  /** Human-readable title of the source document or page. */
  sourceTitle: string | null;
  /** URL when the source is online. */
  sourceUrl: string | null;
  /** Document name/path when the source is offline (e.g. PDF). */
  sourceDocument: string | null;
  /** Page number within the source document, if applicable. */
  sourcePage: number | null;
  /** Publication or last-updated date of the source, ISO-8601 string. */
  sourceDate: string | null;
  /** When this entry was ingested/retrieved, ISO-8601 string. */
  retrievedAt: string | null;
  verificationStatus: VerificationStatus;
  /**
   * Qualitative confidence in this specific entry.
   * Separate from overall source-tier ranking.
   */
  confidence: "high" | "medium" | "low";
};

// ---------------------------------------------------------------------------
// Agricultural knowledge entry
// ---------------------------------------------------------------------------

/**
 * A single verified agricultural knowledge entry.
 *
 * An entry describes one crop × problem combination together with its
 * management options and optional pesticide details. Every entry carries
 * full source provenance.
 */
export type AgriculturalKnowledgeEntry = {
  /** Stable identifier for the entry (ingestion-assigned). */
  id: string;

  // -- Crop / problem context ------------------------------------------------
  /** Crop name (e.g. "wheat", "cotton", "rice"). */
  crop: string;
  problemType: ProblemType;
  /** Primary problem name (e.g. "Yellow Rust", "Bollworm"). */
  problemName: string;
  /** Alternative names / local names for the same problem. */
  aliases: string[];

  // -- Diagnostic / scouting -------------------------------------------------
  /** Observable symptoms described by the source. */
  symptoms: string[];
  /** How to scout / monitor for this problem in the field. */
  scoutingGuidance: string | null;
  /**
   * Economic threshold level — the pest/disease density at which
   * action should be taken to prevent economic loss.
   */
  economicThreshold: string | null;

  // -- Management practices --------------------------------------------------
  culturalManagement: string | null;
  biologicalManagement: string | null;
  preventiveManagement: string | null;
  /**
   * Free-text summary of chemical management options from the source.
   * This is general guidance — for specific pesticide details see
   * `pesticide` below.
   */
  chemicalManagement: string | null;

  // -- Pesticide structured data (optional) ----------------------------------
  /**
   * Pesticide-specific structured fields.
   * Null when the entry does not include pesticide information.
   */
  pesticide: PesticideDetails | null;

  // -- Provenance ------------------------------------------------------------
  source: SourceProvenance;
};

// ---------------------------------------------------------------------------
// Content classification helpers
// ---------------------------------------------------------------------------

/**
 * Classification of how a knowledge entry should be treated when
 * presented to the farmer.
 *
 * - "general_agronomy":
 *     Symptoms, scouting, cultural/biological/preventive management, IPM.
 *     Can be shared when the source is credible, even at lower verification.
 *
 * - "actionable_pesticide":
 *     Product-specific pesticide information (name, dose, PHI, REI,
 *     registration). Requires the strongest verification before the
 *     system may recommend it.
 */
export type ContentClassification = "general_agronomy" | "actionable_pesticide";
