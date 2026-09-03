/**
 * RAG Knowledge Layer — Gemini Embedding Helper
 *
 * Server-only module. Do not import from client components.
 *
 * Generates text embeddings with the Gemini `gemini-embedding-2` model,
 * pinned to exactly 768 output dimensions to match the pgvector
 * `knowledge_chunks.embedding vector(768)` column and the
 * `match_knowledge_chunks(query_embedding vector(768))` RPC.
 *
 * `output_dimensionality` is required: the model default is 3072, and
 * truncated vectors are auto-normalized by the model, which keeps them
 * suitable for pgvector cosine distance.
 *
 * `task_type` is not supported by gemini-embedding-2 — any retrieval
 * instructions must be part of the embedded text itself.
 */

const EMBEDDING_MODEL = "gemini-embedding-2";

/** Must match the pgvector column and RPC signature. */
export const KNOWLEDGE_EMBEDDING_DIMENSIONS = 768;

const EMBED_URL = `https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_MODEL}:embedContent`;

/** Hard cap so a hung upstream request cannot stall the caller. */
const REQUEST_TIMEOUT_MS = 30_000;

/** Safety cap on input size — chunks should stay well below this. */
const MAX_TEXT_LENGTH = 8_000;

/**
 * Sanitized error — safe to log and to re-throw towards callers.
 * Never carries the API key or raw upstream response body.
 */
export class KnowledgeEmbeddingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "KnowledgeEmbeddingError";
  }
}

type EmbedContentResponse = {
  embedding?: { values?: number[] };
};

/**
 * Generates a 768-dimensional embedding for one text string.
 *
 * Throws KnowledgeEmbeddingError when the API key is missing, the text
 * is empty or too long, the upstream request fails, or the returned
 * vector does not have exactly 768 values.
 */
export async function generateKnowledgeEmbedding(
  text: string,
): Promise<number[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new KnowledgeEmbeddingError(
      "GEMINI_API_KEY is not configured on the server.",
    );
  }

  const trimmed = text.trim();
  if (!trimmed) {
    throw new KnowledgeEmbeddingError(
      "Cannot embed an empty text string.",
    );
  }
  if (trimmed.length > MAX_TEXT_LENGTH) {
    throw new KnowledgeEmbeddingError(
      `Embedding input exceeds the maximum of ${MAX_TEXT_LENGTH} characters.`,
    );
  }

  let res: Response;
  try {
    res = await fetch(EMBED_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        content: { parts: [{ text: trimmed }] },
        output_dimensionality: KNOWLEDGE_EMBEDDING_DIMENSIONS,
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (err) {
    console.error(
      "Knowledge embedding request could not be completed:",
      err instanceof Error ? err.message : err,
    );
    throw new KnowledgeEmbeddingError(
      "Could not reach the Gemini embedding API.",
    );
  }

  if (!res.ok) {
    // Full upstream detail stays in the server log only.
    const body = await res.text().catch(() => "");
    console.error(
      `Knowledge embedding request failed with status ${res.status}: ${body.slice(0, 500)}`,
    );
    throw new KnowledgeEmbeddingError(
      `Embedding request failed with status ${res.status}.`,
    );
  }

  const data = (await res.json()) as EmbedContentResponse;
  const values = data.embedding?.values ?? [];

  if (values.length === 0) {
    throw new KnowledgeEmbeddingError("Gemini returned no embedding values.");
  }

  if (values.length !== KNOWLEDGE_EMBEDDING_DIMENSIONS) {
    console.error(
      `Gemini returned ${values.length} dimensions (expected ${KNOWLEDGE_EMBEDDING_DIMENSIONS}).`,
    );
    throw new KnowledgeEmbeddingError(
      `Embedding dimension mismatch: received ${values.length}, expected ${KNOWLEDGE_EMBEDDING_DIMENSIONS}.`,
    );
  }

  return values;
}
