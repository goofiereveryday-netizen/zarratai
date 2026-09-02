/**
 * Training-Manual Dataset — Deterministic Query Helpers (Phase 2A)
 *
 * Server-only module. Do not import from client components.
 *
 * Small manual-specific helpers for querying the training-manual dataset by
 * crop, problem name, and aliases/keywords.
 *
 * DETERMINISTIC MATCHING ONLY — no embeddings, no AI retrieval. These helpers
 * never decide whether an entry may be recommended; they only locate entries.
 * Pesticide actionability is decided exclusively by the verification gates in
 * ../pesticide-verification.ts, and training-manual data is non-actionable
 * for pesticide recommendations until cross-verified against current
 * Tier 1/2 sources.
 */

import type { AgriculturalKnowledgeEntry } from "../types";
import { TRAINING_MANUAL_ENTRIES } from "./dataset";

// ---------------------------------------------------------------------------
// Normalization
// ---------------------------------------------------------------------------

/** Trims, lowercases, and collapses internal whitespace. */
function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

// ---------------------------------------------------------------------------
// Query helpers
// ---------------------------------------------------------------------------

/**
 * Returns all training-manual entries for a crop (case-insensitive,
 * whitespace-insensitive exact match on the crop name).
 */
export function findManualEntriesByCrop(
  crop: string,
  entries: readonly AgriculturalKnowledgeEntry[] = TRAINING_MANUAL_ENTRIES,
): AgriculturalKnowledgeEntry[] {
  const normalizedCrop = normalize(crop);
  if (normalizedCrop === "") return [];
  return entries.filter((entry) => normalize(entry.crop) === normalizedCrop);
}

/**
 * Returns all training-manual entries for a crop whose problem name OR any
 * alias matches the given problem (case-insensitive exact match after
 * whitespace normalization).
 */
export function findManualEntriesByProblem(
  crop: string,
  problem: string,
  entries: readonly AgriculturalKnowledgeEntry[] = TRAINING_MANUAL_ENTRIES,
): AgriculturalKnowledgeEntry[] {
  const normalizedCrop = normalize(crop);
  const normalizedProblem = normalize(problem);
  if (normalizedCrop === "" || normalizedProblem === "") return [];

  return entries.filter((entry) => {
    if (normalize(entry.crop) !== normalizedCrop) return false;
    const names = [entry.problemName, ...entry.aliases].map(normalize);
    return names.includes(normalizedProblem);
  });
}

/**
 * Keyword search across crop, problem name, and aliases
 * (case-insensitive substring matching).
 *
 * Every whitespace-separated term of the query must match (as a substring)
 * at least one of the entry's crop, problemName, or alias fields. This keeps
 * matching deterministic and predictable:
 *
 *   "cotton bollworm"  → entries where "cotton" and "bollworm" both match
 *   "sundee"           → entries with "sundee" (local alias) in any field
 *
 * Returns [] for an empty or whitespace-only query.
 */
export function searchManualEntries(
  query: string,
  entries: readonly AgriculturalKnowledgeEntry[] = TRAINING_MANUAL_ENTRIES,
): AgriculturalKnowledgeEntry[] {
  const tokens = normalize(query)
    .split(" ")
    .filter((token) => token !== "");
  if (tokens.length === 0) return [];

  return entries.filter((entry) => {
    const fields = [entry.crop, entry.problemName, ...entry.aliases].map(
      normalize,
    );
    return tokens.every((token) =>
      fields.some((field) => field.includes(token)),
    );
  });
}

/**
 * Returns a single training-manual entry by its stable id, or null.
 */
export function getManualEntryById(
  id: string,
  entries: readonly AgriculturalKnowledgeEntry[] = TRAINING_MANUAL_ENTRIES,
): AgriculturalKnowledgeEntry | null {
  return entries.find((entry) => entry.id === id) ?? null;
}

/**
 * Lists the distinct crops covered by the training-manual dataset, in
 * dataset order. Useful for coverage audits during ingestion.
 */
export function listManualCrops(
  entries: readonly AgriculturalKnowledgeEntry[] = TRAINING_MANUAL_ENTRIES,
): string[] {
  const seen = new Set<string>();
  const crops: string[] = [];
  for (const entry of entries) {
    if (!seen.has(entry.crop)) {
      seen.add(entry.crop);
      crops.push(entry.crop);
    }
  }
  return crops;
}
