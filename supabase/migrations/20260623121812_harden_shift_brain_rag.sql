CREATE INDEX IF NOT EXISTS idx_brain_docs_ingestion_run_id
  ON public.brain_docs(ingestion_run_id);

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
SET search_path = public, extensions
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

REVOKE EXECUTE ON FUNCTION public.match_brain_chunks(extensions.vector, INTEGER, FLOAT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.match_brain_chunks(extensions.vector, INTEGER, FLOAT) TO service_role;
