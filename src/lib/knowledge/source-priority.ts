/**
 * Agricultural Knowledge Layer — Source Priority Logic
 *
 * Implements the explicit source-priority rule:
 *
 *   Punjab Government (Tier 1)
 *     > Manufacturer (Tier 2)
 *       > Training Manual (Tier 3)
 *         > Commercial Catalog (Tier 4)
 *
 * Lower-priority sources must never override higher-priority sources.
 *
 * Server-only module. Do not import from client components.
 */

import type {
  KnowledgeSourceType,
  SourceTier,
  AgriculturalKnowledgeEntry,
} from "./types";

// ---------------------------------------------------------------------------
// Tier mapping
// ---------------------------------------------------------------------------

/**
 * Maps each source type to its numeric tier (lower = higher authority).
 */
export const SOURCE_TIER: Record<KnowledgeSourceType, SourceTier> = {
  punjab_government: 1,
  manufacturer: 2,
  training_manual: 3,
  commercial_catalog: 4,
};

/**
 * Human-readable labels for each source type, suitable for display
 * in provenance citations.
 */
export const SOURCE_LABEL: Record<KnowledgeSourceType, string> = {
  punjab_government: "Punjab Agriculture Department",
  manufacturer: "Manufacturer / Product Label",
  training_manual: "Government Training Manual",
  commercial_catalog: "Commercial Catalog",
};

// ---------------------------------------------------------------------------
// Ranking helpers
// ---------------------------------------------------------------------------

/**
 * Returns the numeric tier for a given source type.
 */
export function getSourceTier(sourceType: KnowledgeSourceType): SourceTier {
  return SOURCE_TIER[sourceType];
}

/**
 * Returns true when `a` is a strictly higher-priority source than `b`.
 */
export function isHigherPriority(
  a: KnowledgeSourceType,
  b: KnowledgeSourceType,
): boolean {
  return SOURCE_TIER[a] < SOURCE_TIER[b];
}

/**
 * Compares two entries by source tier (ascending tier number = higher
 * authority). Returns a negative number when `a` outranks `b`, a positive
 * number when `b` outranks `a`, or 0 when they share the same tier.
 *
 * Suitable for use as an `Array.prototype.sort` comparator so that
 * the highest-priority entries appear first.
 */
export function compareBySourcePriority(
  a: AgriculturalKnowledgeEntry,
  b: AgriculturalKnowledgeEntry,
): number {
  return a.source.sourceTier - b.source.sourceTier;
}

/**
 * Given a list of entries, returns only those from the highest-priority
 * source tier present in the list.
 *
 * Example: if the list contains entries from tiers 2, 3, and 3,
 * only the tier-2 entries are returned.
 */
export function highestTierEntries(
  entries: AgriculturalKnowledgeEntry[],
): AgriculturalKnowledgeEntry[] {
  if (entries.length === 0) return [];

  const bestTier = Math.min(...entries.map((e) => e.source.sourceTier));
  return entries.filter((e) => e.source.sourceTier === bestTier);
}

/**
 * Returns true when a lower-tier source conflicts with a higher-tier
 * source on the same crop + problem combination. In that case the
 * lower-tier evidence must NOT override the higher-tier evidence.
 *
 * This function does not resolve the conflict — it only detects it
 * so the caller can decide how to present the information.
 */
export function hasTierConflict(
  entry: AgriculturalKnowledgeEntry,
  allEntries: AgriculturalKnowledgeEntry[],
): boolean {
  const sameProblem = allEntries.filter(
    (e) =>
      e.id !== entry.id &&
      e.crop === entry.crop &&
      e.problemName === entry.problemName,
  );

  if (sameProblem.length === 0) return false;

  const bestOtherTier = Math.min(...sameProblem.map((e) => e.source.sourceTier));
  return entry.source.sourceTier > bestOtherTier;
}
