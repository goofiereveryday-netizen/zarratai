/**
 * RAG Knowledge Layer — Supabase Helpers
 *
 * Server-only module. Do not import from client components.
 *
 * Thin, typed helpers over the existing Supabase knowledge tables:
 *   - public.knowledge_documents
 *   - public.knowledge_chunks          (embedding: extensions.vector(768))
 *   - public.match_knowledge_chunks(query_embedding, match_count, filter_crop)
 *
 * ============================================================================
 * TRAINING-MANUAL SAFE DEFAULTS
 * ============================================================================
 *
 * embedAndInsertKnowledgeChunk is the ONLY path training-manual content may
 * use. Its input type deliberately omits `verification_status` and
 * `pesticide_actionable`, and the function hard-codes:
 *   - verification_status = "requires_current_verification"
 *   - pesticide_actionable = false
 * so training-manual ingestion cannot silently produce pesticide-actionable
 * rows — the TypeScript compiler enforces it, not convention.
 *
 * insertKnowledgeChunk is the generic low-level insert for future higher-tier
 * sources; it requires the caller to state both flags explicitly.
 *
 * Write helpers accept an optional injected Supabase client
 * (KnowledgeDbClientOptions). The default is the standard authenticated
 * server client; the DEV-only /api/knowledge/ingest-manual route is the
 * only caller that injects the service-role admin client. Retrieval
 * (searchKnowledgeChunks) accepts NO injection — it always uses the
 * standard authenticated client and the match_knowledge_chunks RPC.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import {
  KNOWLEDGE_EMBEDDING_DIMENSIONS,
  generateKnowledgeEmbedding,
} from "./embedding";

/** Sanitized error — never carries Supabase secrets. */
export class KnowledgeDbError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "KnowledgeDbError";
  }
}

/** Maximum number of chunks a single semantic search may return. */
export const MAX_MATCH_COUNT = 50;

/**
 * Verification status hard-coded for every training-manual chunk.
 * Manual content must always be cross-verified against current Tier 1/2
 * sources before it can support actionable recommendations.
 */
export const TRAINING_MANUAL_CHUNK_VERIFICATION_STATUS =
  "requires_current_verification" as const;

/** Training-manual chunks are never pesticide-actionable on their own. */
export const TRAINING_MANUAL_CHUNK_PESTICIDE_ACTIONABLE = false as const;

// ---------------------------------------------------------------------------
// Normalization (dedup + crop filter convention)
// ---------------------------------------------------------------------------

/**
 * Normalizes text for duplicate comparison: NFKC, collapsed whitespace,
 * trimmed, lowercased. Applied identically to stored and incoming values so
 * the comparison is deterministic regardless of formatting differences.
 */
export function normalizeTextForDedup(value: string): string {
  return value.normalize("NFKC").replace(/\s+/g, " ").trim().toLowerCase();
}

/**
 * Crops are stored and filtered in trimmed lowercase (e.g. "wheat").
 * The `match_knowledge_chunks` crop filter is a plain text comparison, so
 * every writer and every filter must apply the same normalization.
 */
export function normalizeCropForKnowledge(value: string): string {
  return value.trim().toLowerCase();
}

// ---------------------------------------------------------------------------
// Row types (mirror the verified public.* table columns)
// ---------------------------------------------------------------------------

export type KnowledgeDocumentRow = {
  id: string;
  title: string;
  source_document: string;
  source_type: string;
  source_tier: number;
  source_part: string | null;
  source_date: string | null;
  source_url: string | null;
  created_at: string | null;
};

export type KnowledgeChunkRow = {
  id: string;
  document_id: string;
  content: string;
  crop: string | null;
  problem_type: string | null;
  problem_name: string | null;
  source_page: number | null;
  verification_status: string | null;
  pesticide_actionable: boolean | null;
  created_at: string | null;
};

export type MatchedKnowledgeChunk = {
  id: string;
  document_id: string | null;
  content: string;
  crop: string | null;
  problem_type: string | null;
  problem_name: string | null;
  source_page: number | null;
  verification_status: string | null;
  pesticide_actionable: boolean | null;
  similarity: number | null;
};

const DOCUMENT_COLUMNS =
  "id, title, source_document, source_type, source_tier, source_part, source_date, source_url, created_at";

const CHUNK_COLUMNS =
  "id, document_id, content, crop, problem_type, problem_name, source_page, verification_status, pesticide_actionable, created_at";

// ---------------------------------------------------------------------------
// Input validation
// ---------------------------------------------------------------------------

function requireNonEmpty(value: string, field: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new KnowledgeDbError(`${field} must not be empty.`);
  }
  return trimmed;
}

function requireSourcePage(sourcePage: number): number {
  if (!Number.isInteger(sourcePage) || sourcePage < 1 || sourcePage > 10_000) {
    throw new KnowledgeDbError(
      `source_page must be a positive integer between 1 and 10000 (received: ${sourcePage}).`,
    );
  }
  return sourcePage;
}

// ---------------------------------------------------------------------------
// Supabase client resolution (write-path injection)
// ---------------------------------------------------------------------------

/**
 * Optional Supabase client injection for the knowledge write helpers.
 *
 * By default every helper uses the standard authenticated server client —
 * the same one used by all normal app flows. The DEV-only
 * /api/knowledge/ingest-manual route injects the service-role admin client
 * (src/lib/supabase/admin.ts) so seed rows can be written under the
 * locked-down knowledge grants; that route is the ONLY sanctioned caller of
 * an elevated client.
 */
export type KnowledgeDbClientOptions = {
  /** Pre-built Supabase client; defaults to the standard server client. */
  supabase?: SupabaseClient;
};

// ---------------------------------------------------------------------------
// A. Knowledge documents
// ---------------------------------------------------------------------------

export type CreateKnowledgeDocumentInput = {
  title: string;
  sourceDocument: string;
  sourceType: string;
  sourceTier: number;
  /** Which physical part/PDF of the source document this row describes. */
  sourcePart?: string | null;
  /** Publication date (ISO-8601) when known; null otherwise. */
  sourceDate?: string | null;
  sourceUrl?: string | null;
};

/** Inserts one public.knowledge_documents row and returns it. */
export async function createKnowledgeDocument(
  input: CreateKnowledgeDocumentInput,
  options?: KnowledgeDbClientOptions,
): Promise<KnowledgeDocumentRow> {
  const title = requireNonEmpty(input.title, "title");
  const sourceDocument = requireNonEmpty(
    input.sourceDocument,
    "sourceDocument",
  );
  const sourceType = requireNonEmpty(input.sourceType, "sourceType");
  if (!Number.isInteger(input.sourceTier) || input.sourceTier < 1) {
    throw new KnowledgeDbError(
      `sourceTier must be a positive integer (received: ${input.sourceTier}).`,
    );
  }

  const supabase = options?.supabase ?? (await createClient());
  const { data, error } = await supabase
    .from("knowledge_documents")
    .insert({
      title,
      source_document: sourceDocument,
      source_type: sourceType,
      source_tier: input.sourceTier,
      source_part: input.sourcePart?.trim() || null,
      source_date: input.sourceDate?.trim() || null,
      source_url: input.sourceUrl?.trim() || null,
    })
    .select(DOCUMENT_COLUMNS)
    .single();

  if (error || !data) {
    console.error("Failed to create knowledge document:", error?.message);
    throw new KnowledgeDbError(
      `Could not create the knowledge document row: ${error?.message ?? "unknown error"}`,
    );
  }

  return data as KnowledgeDocumentRow;
}

/**
 * Returns the knowledge_documents row for (sourceDocument, sourcePart),
 * creating it first when it does not exist yet. Prevents duplicate document
 * rows across repeated ingestion runs.
 */
export async function getOrCreateKnowledgeDocument(
  input: CreateKnowledgeDocumentInput,
  options?: KnowledgeDbClientOptions,
): Promise<{ document: KnowledgeDocumentRow; created: boolean }> {
  const sourceDocument = requireNonEmpty(
    input.sourceDocument,
    "sourceDocument",
  );
  const sourcePart = input.sourcePart?.trim() || null;

  const supabase = options?.supabase ?? (await createClient());
  let query = supabase
    .from("knowledge_documents")
    .select(DOCUMENT_COLUMNS)
    .eq("source_document", sourceDocument);

  query =
    sourcePart == null
      ? query.is("source_part", null)
      : query.eq("source_part", sourcePart);

  const { data, error } = await query.limit(1).maybeSingle();

  if (error) {
    console.error(
      "Failed to look up knowledge document:",
      error.message,
    );
    throw new KnowledgeDbError(
      `Could not look up the knowledge document row: ${error.message}`,
    );
  }

  if (data) {
    return { document: data as KnowledgeDocumentRow, created: false };
  }

  const document = await createKnowledgeDocument(input, options);
  return { document, created: true };
}

// ---------------------------------------------------------------------------
// B/C. Knowledge chunks
// ---------------------------------------------------------------------------

/** Generic chunk insert — both safety flags must be stated explicitly. */
export type KnowledgeChunkInsertInput = {
  document_id: string;
  content: string;
  crop: string;
  problem_type: string;
  problem_name: string;
  source_page: number;
  verification_status: string;
  pesticide_actionable: boolean;
  embedding: number[];
};

/**
 * Inserts one public.knowledge_chunks row verbatim and returns the stored
 * row (without the embedding vector). Low-level primitive — training-manual
 * code must use embedAndInsertKnowledgeChunk instead.
 */
export async function insertKnowledgeChunk(
  input: KnowledgeChunkInsertInput,
  options?: KnowledgeDbClientOptions,
): Promise<KnowledgeChunkRow> {
  const documentId = requireNonEmpty(input.document_id, "document_id");
  const content = requireNonEmpty(input.content, "content");
  const crop = normalizeCropForKnowledge(input.crop);
  const problemType = requireNonEmpty(input.problem_type, "problem_type");
  const problemName = requireNonEmpty(input.problem_name, "problem_name");
  const sourcePage = requireSourcePage(input.source_page);
  const verificationStatus = requireNonEmpty(
    input.verification_status,
    "verification_status",
  );

  if (!Array.isArray(input.embedding)) {
    throw new KnowledgeDbError("embedding must be an array of numbers.");
  }
  if (input.embedding.length !== KNOWLEDGE_EMBEDDING_DIMENSIONS) {
    throw new KnowledgeDbError(
      `embedding must have exactly ${KNOWLEDGE_EMBEDDING_DIMENSIONS} dimensions (received: ${input.embedding.length}).`,
    );
  }

  const supabase = options?.supabase ?? (await createClient());
  const { data, error } = await supabase
    .from("knowledge_chunks")
    .insert({
      document_id: documentId,
      content,
      crop,
      problem_type: problemType,
      problem_name: problemName,
      source_page: sourcePage,
      verification_status: verificationStatus,
      pesticide_actionable: input.pesticide_actionable,
      embedding: input.embedding,
    })
    .select(CHUNK_COLUMNS)
    .single();

  if (error || !data) {
    console.error("Failed to insert knowledge chunk:", error?.message);
    throw new KnowledgeDbError(
      `Could not insert the knowledge chunk: ${error?.message ?? "unknown error"}`,
    );
  }

  return data as KnowledgeChunkRow;
}

/**
 * Training-manual chunk input. Deliberately omits verification_status,
 * pesticide_actionable and embedding — the function decides those itself.
 */
export type TrainingManualChunkInput = {
  document_id: string;
  content: string;
  crop: string;
  problem_type: string;
  problem_name: string;
  source_page: number;
};

export type EmbedAndInsertOutcome =
  | {
      status: "inserted";
      chunk: KnowledgeChunkRow;
      /** false when the duplicate pre-check could not run (e.g. missing SELECT grant). */
      dedupChecked: boolean;
    }
  | { status: "skipped_duplicate"; existingChunkId: string }
  | { status: "failed"; reason: string };

/**
 * Embeds one training-manual chunk with Gemini and inserts it with the
 * mandatory safe defaults (requires_current_verification, not
 * pesticide-actionable), skipping it when an equivalent chunk already
 * exists.
 *
 * Duplicate detection is deterministic over:
 *   document (source document + source part, via document_id)
 *   + source_page + crop + problem_name + normalized content.
 */
export async function embedAndInsertKnowledgeChunk(
  input: TrainingManualChunkInput,
  options?: KnowledgeDbClientOptions,
): Promise<EmbedAndInsertOutcome> {
  let documentId: string;
  let content: string;
  let crop: string;
  let problemName: string;
  let sourcePage: number;
  try {
    documentId = requireNonEmpty(input.document_id, "document_id");
    content = requireNonEmpty(input.content, "content");
    crop = normalizeCropForKnowledge(input.crop);
    problemName = requireNonEmpty(input.problem_name, "problem_name");
    requireNonEmpty(input.problem_type, "problem_type");
    sourcePage = requireSourcePage(input.source_page);
  } catch (err) {
    return {
      status: "failed",
      reason: err instanceof Error ? err.message : "Invalid chunk input.",
    };
  }

  // 1. Duplicate pre-check before spending an embedding API call.
  const dedup = await findDuplicateChunk(
    {
      documentId,
      sourcePage,
      crop,
      problemName,
      content,
    },
    options?.supabase,
  );

  if (dedup.kind === "error") {
    console.warn(
      "Knowledge chunk duplicate check could not run:",
      dedup.message,
    );
  } else if (dedup.kind === "duplicate") {
    return {
      status: "skipped_duplicate",
      existingChunkId: dedup.existingChunkId,
    };
  }

  // 2. Embed the content (768 dimensions, validated by the helper).
  let embedding: number[];
  try {
    embedding = await generateKnowledgeEmbedding(content);
  } catch (err) {
    console.error(
      "Training-manual chunk embedding failed:",
      err instanceof Error ? err.message : err,
    );
    return {
      status: "failed",
      reason:
        err instanceof Error
          ? err.message
          : "Embedding generation failed for the chunk.",
    };
  }

  // 3. Insert with the hard-coded training-manual safe defaults.
  try {
    const chunk = await insertKnowledgeChunk(
      {
        document_id: documentId,
        content,
        crop,
        problem_type: input.problem_type.trim(),
        problem_name: problemName,
        source_page: sourcePage,
        verification_status: TRAINING_MANUAL_CHUNK_VERIFICATION_STATUS,
        pesticide_actionable: TRAINING_MANUAL_CHUNK_PESTICIDE_ACTIONABLE,
        embedding,
      },
      options,
    );

    return {
      status: "inserted",
      chunk,
      dedupChecked: dedup.kind !== "error",
    };
  } catch (err) {
    return {
      status: "failed",
      reason:
        err instanceof Error ? err.message : "Knowledge chunk insert failed.",
    };
  }
}

type DuplicateKey = {
  documentId: string;
  sourcePage: number;
  crop: string;
  problemName: string;
  content: string;
};

type DuplicateLookup =
  | { kind: "duplicate"; existingChunkId: string }
  | { kind: "no-duplicate" }
  | { kind: "error"; message: string };

async function findDuplicateChunk(
  key: DuplicateKey,
  supabase?: SupabaseClient,
): Promise<DuplicateLookup> {
  const client = supabase ?? (await createClient());
  const { data, error } = await client
    .from("knowledge_chunks")
    .select("id, crop, problem_name, content")
    .eq("document_id", key.documentId)
    .eq("source_page", key.sourcePage);

  if (error) {
    return { kind: "error", message: error.message };
  }

  const normalizedContent = normalizeTextForDedup(key.content);
  const normalizedCrop = normalizeTextForDedup(key.crop);
  const normalizedProblemName = normalizeTextForDedup(key.problemName);

  for (const row of data ?? []) {
    const sameCrop =
      normalizeTextForDedup(row.crop ?? "") === normalizedCrop;
    const sameProblem =
      normalizeTextForDedup(row.problem_name ?? "") === normalizedProblemName;
    const sameContent =
      normalizeTextForDedup(row.content ?? "") === normalizedContent;

    if (sameCrop && sameProblem && sameContent) {
      return { kind: "duplicate", existingChunkId: row.id as string };
    }
  }

  return { kind: "no-duplicate" };
}

// ---------------------------------------------------------------------------
// D. Semantic search (existing match_knowledge_chunks RPC)
// ---------------------------------------------------------------------------

/**
 * Semantic search over knowledge_chunks via the existing
 * public.match_knowledge_chunks(query_embedding, match_count, filter_crop)
 * RPC. `crop` is normalized (trimmed lowercase) before filtering.
 */
export async function searchKnowledgeChunks(options: {
  queryEmbedding: number[];
  matchCount: number;
  crop?: string | null;
}): Promise<MatchedKnowledgeChunk[]> {
  if (!Array.isArray(options.queryEmbedding)) {
    throw new KnowledgeDbError("queryEmbedding must be an array of numbers.");
  }
  if (
    options.queryEmbedding.length !== KNOWLEDGE_EMBEDDING_DIMENSIONS
  ) {
    throw new KnowledgeDbError(
      `queryEmbedding must have exactly ${KNOWLEDGE_EMBEDDING_DIMENSIONS} dimensions (received: ${options.queryEmbedding.length}).`,
    );
  }
  if (
    !Number.isInteger(options.matchCount) ||
    options.matchCount < 1 ||
    options.matchCount > MAX_MATCH_COUNT
  ) {
    throw new KnowledgeDbError(
      `matchCount must be an integer between 1 and ${MAX_MATCH_COUNT} (received: ${options.matchCount}).`,
    );
  }

  const filterCrop = options.crop?.trim()
    ? normalizeCropForKnowledge(options.crop!)
    : null;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("match_knowledge_chunks", {
    query_embedding: options.queryEmbedding,
    match_count: options.matchCount,
    filter_crop: filterCrop,
  });

  if (error) {
    console.error("Knowledge semantic search failed:", error.message);
    throw new KnowledgeDbError(
      `Knowledge semantic search failed: ${error.message}`,
    );
  }

  return (Array.isArray(data) ? data : []).map(mapRpcMatchRow);
}

/** Defensive mapper — tolerates missing or extra fields in the RPC result. */
function mapRpcMatchRow(row: Record<string, unknown>): MatchedKnowledgeChunk {
  return {
    id: row.id == null ? "" : String(row.id),
    document_id: toTextOrNull(row.document_id),
    content: toTextOrNull(row.content) ?? "",
    crop: toTextOrNull(row.crop),
    problem_type: toTextOrNull(row.problem_type),
    problem_name: toTextOrNull(row.problem_name),
    source_page: toNumberOrNull(row.source_page),
    verification_status: toTextOrNull(row.verification_status),
    pesticide_actionable: toBoolOrNull(row.pesticide_actionable),
    similarity: toNumberOrNull(row.similarity),
  };
}

function toTextOrNull(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function toNumberOrNull(value: unknown): number | null {
  return typeof value === "number" ? value : null;
}

function toBoolOrNull(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}
