CREATE TABLE IF NOT EXISTS public.brain_doc_staging (
  ingestion_run_id UUID NOT NULL REFERENCES public.brain_ingestion_runs(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
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
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (ingestion_run_id, id),
  CHECK (pii_risk = 'none'),
  CHECK (platform_flag = 'none'),
  CHECK (length(btrim(text)) > 0)
);

CREATE TABLE IF NOT EXISTS public.brain_chunk_staging (
  ingestion_run_id UUID NOT NULL,
  doc_id TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  chunk TEXT NOT NULL,
  chunk_hash TEXT NOT NULL,
  token_estimate INTEGER NOT NULL DEFAULT 0,
  embedding_model TEXT NOT NULL DEFAULT 'text-embedding-3-small',
  embedding extensions.vector(1536) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (ingestion_run_id, doc_id, chunk_index, embedding_model),
  FOREIGN KEY (ingestion_run_id, doc_id)
    REFERENCES public.brain_doc_staging(ingestion_run_id, id)
    ON DELETE CASCADE,
  CHECK (length(btrim(chunk)) > 0)
);

ALTER TABLE public.brain_doc_staging ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brain_chunk_staging ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.brain_doc_staging FROM anon, authenticated;
REVOKE ALL ON public.brain_chunk_staging FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.brain_doc_staging TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.brain_chunk_staging TO service_role;

CREATE OR REPLACE FUNCTION public.promote_shift_brain_ingestion(p_run_id UUID)
RETURNS TABLE (doc_rows INTEGER, chunk_rows INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  expected_docs INTEGER;
  expected_chunks INTEGER;
  staged_docs INTEGER;
  staged_chunks INTEGER;
BEGIN
  SELECT approved_rows, chunk_rows
  INTO expected_docs, expected_chunks
  FROM public.brain_ingestion_runs
  WHERE id = p_run_id;

  IF expected_docs IS NULL THEN
    RAISE EXCEPTION 'Brain ingestion run % not found', p_run_id;
  END IF;

  SELECT COUNT(*) INTO staged_docs
  FROM public.brain_doc_staging
  WHERE ingestion_run_id = p_run_id;

  SELECT COUNT(*) INTO staged_chunks
  FROM public.brain_chunk_staging
  WHERE ingestion_run_id = p_run_id;

  IF staged_docs <> expected_docs THEN
    RAISE EXCEPTION 'Staged doc count % does not match expected % for run %', staged_docs, expected_docs, p_run_id;
  END IF;

  IF staged_chunks <> expected_chunks THEN
    RAISE EXCEPTION 'Staged chunk count % does not match expected % for run %', staged_chunks, expected_chunks, p_run_id;
  END IF;

  DELETE FROM public.brain_chunks;
  DELETE FROM public.brain_docs;

  INSERT INTO public.brain_docs (
    id,
    source_title,
    category,
    provenance,
    text,
    principles,
    coaching_moves,
    hierarchy_links,
    pii_risk,
    platform_flag,
    source_hash,
    ingestion_run_id,
    created_at,
    updated_at
  )
  SELECT
    id,
    source_title,
    category,
    provenance,
    text,
    principles,
    coaching_moves,
    hierarchy_links,
    pii_risk,
    platform_flag,
    source_hash,
    ingestion_run_id,
    created_at,
    updated_at
  FROM public.brain_doc_staging
  WHERE ingestion_run_id = p_run_id;

  INSERT INTO public.brain_chunks (
    doc_id,
    chunk_index,
    chunk,
    chunk_hash,
    token_estimate,
    embedding_model,
    embedding,
    created_at
  )
  SELECT
    doc_id,
    chunk_index,
    chunk,
    chunk_hash,
    token_estimate,
    embedding_model,
    embedding,
    created_at
  FROM public.brain_chunk_staging
  WHERE ingestion_run_id = p_run_id;

  DELETE FROM public.brain_chunk_staging
  WHERE ingestion_run_id = p_run_id;
  DELETE FROM public.brain_doc_staging
  WHERE ingestion_run_id = p_run_id;

  RETURN QUERY SELECT staged_docs, staged_chunks;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.promote_shift_brain_ingestion(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.promote_shift_brain_ingestion(UUID) TO service_role;
