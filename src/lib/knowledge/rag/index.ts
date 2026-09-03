/**
 * RAG Knowledge Layer — Public API
 *
 * Server-only module. Do not import from client components.
 *
 * Phase scope: real knowledge rows → Gemini embeddings → Supabase →
 * semantic retrieval test. Retrieval results are NOT yet connected to the
 * Gemini assistant flow — that integration is a later phase.
 *
 * Ingestion of training-manual content must go through
 * ingestManualSeedRecords (hard-coded seed records only — never arbitrary
 * input), which enforces the mandatory training-manual safe defaults.
 */

export {
  generateKnowledgeEmbedding,
  KnowledgeEmbeddingError,
  KNOWLEDGE_EMBEDDING_DIMENSIONS,
} from "./embedding";

export {
  createKnowledgeDocument,
  embedAndInsertKnowledgeChunk,
  getOrCreateKnowledgeDocument,
  insertKnowledgeChunk,
  KnowledgeDbError,
  MAX_MATCH_COUNT,
  normalizeCropForKnowledge,
  normalizeTextForDedup,
  searchKnowledgeChunks,
  TRAINING_MANUAL_CHUNK_PESTICIDE_ACTIONABLE,
  TRAINING_MANUAL_CHUNK_VERIFICATION_STATUS,
} from "./db";

export type {
  CreateKnowledgeDocumentInput,
  EmbedAndInsertOutcome,
  KnowledgeChunkInsertInput,
  KnowledgeChunkRow,
  KnowledgeDocumentRow,
  MatchedKnowledgeChunk,
  TrainingManualChunkInput,
} from "./db";

export { MANUAL_SEED_RECORDS, MANUAL_SOURCE_PARTS } from "./manual-seed";

export type { ManualSeedRecord, ManualSourcePart } from "./manual-seed";

export { ingestManualSeedRecords } from "./ingest";

export type {
  ManualSeedFailure,
  ManualSeedIngestionSummary,
} from "./ingest";
