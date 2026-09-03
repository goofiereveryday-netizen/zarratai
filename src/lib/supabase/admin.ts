/**
 * Supabase Admin Client — Service-Role (DEV knowledge ingestion ONLY)
 *
 * Server-only module. Do not import from client components.
 *
 * ============================================================================
 * THE SERVICE-ROLE KEY BYPASSES ROW-LEVEL SECURITY ON EVERY TABLE.
 * ============================================================================
 *
 * This client exists for exactly one purpose: developer-only ingestion of
 * the training-manual seed records through POST /api/knowledge/ingest-manual.
 * Under the knowledge security model, anon/authenticated hold no direct
 * privileges on knowledge_documents/knowledge_chunks, so writing seed rows
 * requires the service role. This is an explicit, user-authorized exception.
 *
 * HARD RULES:
 *   - This module must only ever be imported by the DEV-only
 *     /api/knowledge/ingest-manual route — never by client components,
 *     server actions, or normal app flows (auth, farms, consultations,
 *     assistant, retrieval).
 *   - The key is read from SUPABASE_SERVICE_ROLE_KEY. It is a non-
 *     NEXT_PUBLIC_ variable, so Next.js never inlines it into browser
 *     bundles — and it must never be logged, returned in a response, or
 *     persisted anywhere.
 *   - The factory refuses to run outside development (NODE_ENV guard) and
 *     refuses to run when the key is missing.
 *   - This client never replaces the standard authenticated Supabase
 *     server client; it is created per request, stateless, and discarded.
 */

import { createClient } from "@supabase/supabase-js";

/** Sanitized construction error — never carries the service-role key. */
export class SupabaseAdminClientError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SupabaseAdminClientError";
  }
}

/**
 * Creates the dev-only service-role Supabase client for knowledge
 * ingestion.
 *
 * Uses the same project URL as the standard server configuration
 * (NEXT_PUBLIC_SUPABASE_URL — a public value carrying no secret) together
 * with the SUPABASE_SERVICE_ROLE_KEY secret.
 *
 * Throws (without ever revealing the key) when:
 *   - NODE_ENV is "production" — the ingestion path is dev-only;
 *   - SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_URL is missing.
 */
export function createKnowledgeAdminClient() {
  if (process.env.NODE_ENV === "production") {
    throw new SupabaseAdminClientError(
      "The knowledge ingestion admin client is dev-only and refuses to run in production.",
    );
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!serviceRoleKey) {
    throw new SupabaseAdminClientError(
      "SUPABASE_SERVICE_ROLE_KEY is not configured — developer-only ingestion cannot run.",
    );
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!supabaseUrl) {
    throw new SupabaseAdminClientError(
      "NEXT_PUBLIC_SUPABASE_URL is not configured.",
    );
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      // Stateless per-request connection — the service role is not a user
      // session, so there is nothing to persist or refresh.
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
