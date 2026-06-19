CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

CREATE TABLE IF NOT EXISTS public.brain_ingestion_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_name TEXT NOT NULL,
  source_sha256 TEXT,
  review_sha256 TEXT,
  scope TEXT NOT NULL DEFAULT 'client',
  total_rows INTEGER NOT NULL DEFAULT 0,
  approved_rows INTEGER NOT NULL DEFAULT 0,
  excluded_rows INTEGER NOT NULL DEFAULT 0,
  chunk_rows INTEGER NOT NULL DEFAULT 0,
  embedding_model TEXT NOT NULL,
  report JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.brain_docs (
  id TEXT PRIMARY KEY,
  source_title TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('methodology', 'build', 'client_session', 'other')),
  provenance TEXT NOT NULL CHECK (provenance IN ('gordy_direct', 'client_session_distilled')),
  text TEXT NOT NULL,
  principles JSONB NOT NULL DEFAULT '[]'::jsonb,
  coaching_moves JSONB NOT NULL DEFAULT '[]'::jsonb,
  hierarchy_links JSONB NOT NULL DEFAULT '[]'::jsonb,
  pii_risk TEXT NOT NULL DEFAULT 'none',
  platform_flag TEXT NOT NULL DEFAULT 'none',
  source_hash TEXT NOT NULL,
  ingestion_run_id UUID REFERENCES public.brain_ingestion_runs(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (pii_risk = 'none'),
  CHECK (platform_flag = 'none'),
  CHECK (length(btrim(text)) > 0)
);

CREATE TABLE IF NOT EXISTS public.brain_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_id TEXT NOT NULL REFERENCES public.brain_docs(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  chunk TEXT NOT NULL,
  chunk_hash TEXT NOT NULL,
  token_estimate INTEGER NOT NULL DEFAULT 0,
  embedding_model TEXT NOT NULL DEFAULT 'text-embedding-3-small',
  embedding extensions.vector(1536) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (doc_id, chunk_index, embedding_model),
  CHECK (length(btrim(chunk)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_brain_docs_category
  ON public.brain_docs(category);

CREATE INDEX IF NOT EXISTS idx_brain_docs_hierarchy_links
  ON public.brain_docs USING gin(hierarchy_links);

CREATE INDEX IF NOT EXISTS idx_brain_chunks_doc_id
  ON public.brain_chunks(doc_id);

CREATE INDEX IF NOT EXISTS idx_brain_chunks_embedding_hnsw
  ON public.brain_chunks
  USING hnsw (embedding vector_cosine_ops);

ALTER TABLE public.brain_ingestion_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brain_docs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brain_chunks ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.brain_ingestion_runs TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.brain_docs TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.brain_chunks TO service_role;

CREATE OR REPLACE FUNCTION public.match_brain_chunks(
  query_embedding extensions.vector(1536),
  match_count INTEGER DEFAULT 8,
  similarity_threshold FLOAT DEFAULT 0.2
)
RETURNS TABLE (
  chunk_id UUID,
  doc_id TEXT,
  source_title TEXT,
  category TEXT,
  provenance TEXT,
  hierarchy_links JSONB,
  chunk TEXT,
  similarity FLOAT
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    brain_chunks.id AS chunk_id,
    brain_docs.id AS doc_id,
    brain_docs.source_title,
    brain_docs.category,
    brain_docs.provenance,
    brain_docs.hierarchy_links,
    brain_chunks.chunk,
    1 - (brain_chunks.embedding <=> query_embedding) AS similarity
  FROM public.brain_chunks
  JOIN public.brain_docs ON brain_docs.id = brain_chunks.doc_id
  WHERE 1 - (brain_chunks.embedding <=> query_embedding) >= similarity_threshold
  ORDER BY brain_chunks.embedding <=> query_embedding
  LIMIT LEAST(GREATEST(match_count, 1), 20);
$$;

REVOKE EXECUTE ON FUNCTION public.match_brain_chunks(extensions.vector, INTEGER, FLOAT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.match_brain_chunks(extensions.vector, INTEGER, FLOAT) TO service_role;
