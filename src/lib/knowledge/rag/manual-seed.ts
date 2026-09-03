/**
 * RAG Knowledge Layer — Training-Manual Seed Records
 *
 * Server-only module. Do not import from client components.
 *
 * ============================================================================
 * RECORDS BELOW COME ONLY FROM MANUALLY EXTRACTED BATCHES — NEVER DRAFTED.
 * ============================================================================
 *
 * The manual consists of three source parts (PDFs) that Qoder cannot read
 * directly. Records are therefore provided ONLY as manually verified rows
 * added to MANUAL_SEED_RECORDS below by a human who has read the manual.
 * Batch contents are translations/summaries of the Urdu source — they are
 * NOT independently verified current government guidance.
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
 * Batch 1 (19 records): wheat, part-2 ("till 66 pages of pesticide book.pdf"),
 * pages 37-46 — manually extracted and reviewed from the uploaded training
 * manual. Append further batches below — never commit placeholder data.
 *
 * Category adaptation for the shared ProblemType vocabulary (the batch used
 * finer-grained categories that ProblemType does not define):
 *   - batch "weed_management"   → recorded as "weed"
 *   - batch "stored_grain_pest" → recorded as "pest"
 * The distinction stays preserved in problemName and content.
 */
export const MANUAL_SEED_RECORDS: readonly ManualSeedRecord[] = [
  // -- Weeds (pages 37-38) ----------------------------------------------------

  {
    sourcePart: "part-2",
    sourcePage: 37,
    crop: "wheat",
    problemType: "weed",
    problemName: "Weed competition in wheat",
    content:
      "Weeds compete with wheat for water, nutrients, light and space and can reduce crop yield. Wheat weed management should begin with identification of the weed type and timely control.",
  },

  {
    sourcePart: "part-2",
    sourcePage: 38,
    crop: "wheat",
    problemType: "weed",
    problemName: "Broad-leaved weeds",
    content:
      "Broad-leaved weeds in wheat have relatively broad leaves and include several common field weeds. Correct identification is important because broad-leaved and narrow-leaved weeds require different management approaches.",
  },

  {
    sourcePart: "part-2",
    sourcePage: 38,
    crop: "wheat",
    problemType: "weed",
    problemName: "Narrow-leaved weeds",
    content:
      "Narrow-leaved weeds in wheat resemble grasses and have narrow leaves. They should be distinguished from broad-leaved weeds before selecting a control strategy.",
  },

  // -- Weed-management methods (pages 38-39) -----------------------------------

  {
    sourcePart: "part-2",
    sourcePage: 38,
    crop: "wheat",
    problemType: "weed",
    problemName: "Buried method / pre-sowing irrigation",
    content:
      "A cultural weed-management method described for wheat is pre-sowing irrigation followed by allowing weeds to emerge and then destroying them before sowing the crop.",
  },

  {
    sourcePart: "part-2",
    sourcePage: 39,
    crop: "wheat",
    problemType: "weed",
    problemName: "Bar harrow",
    content:
      "Bar harrowing is described as a mechanical method that can help reduce weeds in wheat when used appropriately during crop establishment.",
  },

  {
    sourcePart: "part-2",
    sourcePage: 39,
    crop: "wheat",
    problemType: "weed",
    problemName: "Hoeing",
    content:
      "Hoeing is a physical weed-control method that removes or suppresses weeds and can be used where field conditions and crop spacing permit.",
  },

  {
    sourcePart: "part-2",
    sourcePage: 39,
    crop: "wheat",
    problemType: "weed",
    problemName: "Crop rotation",
    content:
      "Crop rotation is described as a cultural practice for reducing repeated weed problems by changing the crop and disrupting weed establishment patterns.",
  },

  // -- Pests (pages 42-43) -----------------------------------------------------

  {
    sourcePart: "part-2",
    sourcePage: 42,
    crop: "wheat",
    problemType: "pest",
    problemName: "Termite",
    content:
      "Termites can attack wheat plants and damage roots and underground plant parts. Infestation may weaken plants and contribute to patches of poor crop growth.",
  },

  {
    sourcePart: "part-2",
    sourcePage: 42,
    crop: "wheat",
    problemType: "pest",
    problemName: "Aphid",
    content:
      "Aphids are sucking insects that feed on wheat plant sap. Heavy infestation can weaken plants and may become more damaging when populations increase rapidly.",
  },

  {
    sourcePart: "part-2",
    sourcePage: 43,
    crop: "wheat",
    problemType: "pest",
    problemName: "Rats",
    content:
      "Rats can damage wheat in fields and stored grain by feeding on grain and plants. Their activity can cause direct crop loss and contamination.",
  },

  // -- Diseases (pages 43-44) ---------------------------------------------------

  {
    sourcePart: "part-2",
    sourcePage: 43,
    crop: "wheat",
    problemType: "disease",
    problemName: "Loose Smut of Wheat",
    content:
      "Loose smut is a fungal disease of wheat. Infected ears are transformed into masses of dark fungal spores instead of normal grain, causing direct loss of the affected ear.",
  },

  {
    sourcePart: "part-2",
    sourcePage: 44,
    crop: "wheat",
    problemType: "disease",
    problemName: "Damping-off Disease",
    content:
      "Damping-off affects young wheat seedlings. Infection can cause seedling weakness, decay or death around emergence and early establishment.",
  },

  {
    sourcePart: "part-2",
    sourcePage: 44,
    crop: "wheat",
    problemType: "disease",
    problemName: "Ear Cockle of Wheat",
    content:
      "Ear cockle is associated with the nematode Anguina tritici. Affected wheat ears may contain abnormal seed-like galls instead of healthy grain, and contaminated seed can spread the problem.",
  },

  {
    sourcePart: "part-2",
    sourcePage: 44,
    crop: "wheat",
    problemType: "disease",
    problemName: "Rust of Wheat",
    content:
      "Wheat rust occurs in different forms including yellow or stripe rust, brown or leaf rust, and black or stem rust. Rust symptoms develop on plant surfaces and severe infection can reduce crop performance.",
  },

  {
    sourcePart: "part-2",
    sourcePage: 44,
    crop: "wheat",
    problemType: "disease",
    problemName: "Yellow or Stripe Rust",
    content:
      "Yellow or stripe rust is one form of wheat rust described in the manual. Yellowish rust symptoms appearing in lines or stripes on wheat leaves should be considered when diagnosing yellowing or rust-like symptoms.",
  },

  // -- Stored-grain pests (page 46) ---------------------------------------------

  {
    sourcePart: "part-2",
    sourcePage: 46,
    crop: "wheat",
    problemType: "pest",
    problemName: "Weevil",
    content:
      "Weevils are important stored-wheat pests. Adults and immature stages can damage stored grain and reduce grain quality.",
  },

  {
    sourcePart: "part-2",
    sourcePage: 46,
    crop: "wheat",
    problemType: "pest",
    problemName: "Angoumois Grain Moth",
    content:
      "Angoumois grain moth is a stored-grain pest of wheat. Its immature stage develops in grain and can damage stored kernels.",
  },

  {
    sourcePart: "part-2",
    sourcePage: 46,
    crop: "wheat",
    problemType: "pest",
    problemName: "Wheat Beetle",
    content:
      "Wheat beetles can infest stored wheat and cause feeding damage, weight loss and deterioration of stored grain quality.",
  },

  {
    sourcePart: "part-2",
    sourcePage: 46,
    crop: "wheat",
    problemType: "pest",
    problemName: "Flour Beetle",
    content:
      "Flour beetles are associated with stored cereal products and damaged grain. Infestation contributes to deterioration and contamination of stored wheat products.",
  },
];

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
