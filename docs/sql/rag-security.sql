-- ============================================================================
-- RAG KNOWLEDGE LAYER — SECURITY MODEL (MANUAL STEP — NOT APPLIED BY THE APP)
-- ============================================================================
-- Run in the Supabase SQL editor (executes as the postgres role).
--
-- Target security model:
--   1. Raw knowledge tables (public.knowledge_documents,
--      public.knowledge_chunks) stay INACCESSIBLE to anon AND normal
--      authenticated users (no direct SELECT/INSERT/UPDATE/DELETE).
--   2. Semantic retrieval is exposed ONLY through this SECURITY DEFINER RPC,
--      returning the already-defined safe result columns.
--   3. EXECUTE is granted to authenticated users only — anon gets nothing.
--   4. Developer/admin ingestion is NOT solved here (no INSERT grants);
--      it must be authorized separately (e.g. service-role client or the
--      SQL editor).
--
-- STEP 0 — VERIFY THE CURRENT DEFINITION FIRST.
-- Run this query alone and compare: the replacement below must keep the
-- same parameter names, types and order, and the same return columns.
-- If the output differs (e.g. different argument order or column types),
-- STOP and adjust the declaration in STEP 1 to match before running it.
--
--   select pg_get_functiondef(p.oid) as definition
--   from pg_proc p
--   join pg_namespace n on n.oid = p.pronamespace
--   where n.nspname = 'public'
--     and p.proname = 'match_knowledge_chunks';
--
-- ============================================================================

-- STEP 1 — Replace the RPC with a SECURITY DEFINER version.
--
-- * SECURITY DEFINER: the function executes as its owner (postgres), so it
--   can read knowledge_chunks WITHOUT any direct table grants for
--   anon/authenticated.
-- * SET search_path = pg_catalog, extensions: pinned explicitly so a hostile
--   search_path cannot redirect object/operator resolution. public is NOT
--   in the path because the table reference is already fully qualified; the
--   <=> operator resolves from the extensions schema (pgvector), and
--   operators are never searched in pg_temp.
-- * Returns ONLY the safe result columns (no embedding vector, no
--   internal metadata): id, document_id, content, crop, problem_type,
--   problem_name, source_page, verification_status,
--   pesticide_actionable, similarity (cosine similarity, closest first).
--
-- NOTE: CREATE OR REPLACE cannot change a function's return type. If it
-- errors with "cannot change return type of existing function", the
-- current return shape differs from the one below — report it back
-- instead of forcing a DROP.

create or replace function public.match_knowledge_chunks(
  query_embedding extensions.vector(768),
  match_count int default 5,
  filter_crop text default null
)
returns table(
  id uuid,
  document_id uuid,
  content text,
  crop text,
  problem_type text,
  problem_name text,
  source_page int,
  verification_status text,
  pesticide_actionable boolean,
  similarity double precision
)
language sql
stable
security definer
set search_path = pg_catalog, extensions
as $$
  select
    public.knowledge_chunks.id,
    public.knowledge_chunks.document_id,
    public.knowledge_chunks.content,
    public.knowledge_chunks.crop,
    public.knowledge_chunks.problem_type,
    public.knowledge_chunks.problem_name,
    public.knowledge_chunks.source_page,
    public.knowledge_chunks.verification_status,
    public.knowledge_chunks.pesticide_actionable,
    1 - (public.knowledge_chunks.embedding <=> query_embedding) as similarity
  from public.knowledge_chunks
  where public.knowledge_chunks.embedding is not null
    and (
      filter_crop is null
      or lower(public.knowledge_chunks.crop) = lower(filter_crop)
    )
  order by public.knowledge_chunks.embedding <=> query_embedding
  limit match_count;
$$;

-- STEP 2 — Restrict function execution.
--
-- Revoke the default PUBLIC EXECUTE (which also covers anon), then grant
-- execution to authenticated users only.

revoke execute on function public.match_knowledge_chunks(extensions.vector(768), int, text)
  from public, anon;

grant execute on function public.match_knowledge_chunks(extensions.vector(768), int, text)
  to authenticated;

-- STEP 3 — Defensive: keep the raw knowledge tables locked down.
--
-- No direct table privileges for anon or authenticated, so retrieval can
-- only happen through the RPC above and no normal user can ever
-- INSERT/UPDATE/DELETE knowledge rows. These statements are no-ops for
-- privileges that were never granted, so they are safe to re-run.

revoke all on public.knowledge_documents, public.knowledge_chunks
  from public, anon, authenticated;

-- STEP 4 — Document metadata lookup for source attribution.
--
-- The assistant needs to know which source document each retrieved chunk
-- came from (e.g. "dealer training manual", "government report",
-- "manufacturer brochure") so it can attribute answers correctly.
--
-- This SECURITY DEFINER function returns ONLY safe metadata columns from
-- knowledge_documents — no embedding, no chunk content. It does NOT
-- require any direct table grants on knowledge_documents; the function
-- itself runs as postgres.
--
-- EXECUTE is granted to authenticated only, matching the retrieval RPC.

create or replace function public.get_knowledge_document_metadata(
  document_ids uuid[]
)
returns table(
  id uuid,
  source_document text,
  source_type text,
  source_tier int,
  source_part text
)
language sql
stable
security definer
set search_path = pg_catalog, extensions
as $$
  select
    public.knowledge_documents.id,
    public.knowledge_documents.source_document,
    public.knowledge_documents.source_type,
    public.knowledge_documents.source_tier,
    public.knowledge_documents.source_part
  from public.knowledge_documents
  where public.knowledge_documents.id = any(document_ids);
$$;

revoke execute on function public.get_knowledge_document_metadata(uuid[])
  from public, anon;

grant execute on function public.get_knowledge_document_metadata(uuid[])
  to authenticated;
