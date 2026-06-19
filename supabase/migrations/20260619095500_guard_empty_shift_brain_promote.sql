CREATE OR REPLACE FUNCTION public.promote_shift_brain_ingestion(p_run_id UUID)
RETURNS TABLE (doc_rows INTEGER, chunk_rows INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_expected_docs INTEGER;
  v_expected_chunks INTEGER;
  v_staged_docs INTEGER;
  v_staged_chunks INTEGER;
BEGIN
  SELECT runs.approved_rows, runs.chunk_rows
  INTO v_expected_docs, v_expected_chunks
  FROM public.brain_ingestion_runs AS runs
  WHERE runs.id = p_run_id;

  IF v_expected_docs IS NULL THEN
    RAISE EXCEPTION 'Brain ingestion run % not found', p_run_id;
  END IF;

  IF v_expected_docs <= 0 OR v_expected_chunks <= 0 THEN
    RAISE EXCEPTION 'Refusing to promote empty SHIFT brain ingestion run %', p_run_id;
  END IF;

  SELECT COUNT(*) INTO v_staged_docs
  FROM public.brain_doc_staging
  WHERE ingestion_run_id = p_run_id;

  SELECT COUNT(*) INTO v_staged_chunks
  FROM public.brain_chunk_staging
  WHERE ingestion_run_id = p_run_id;

  IF v_staged_docs <> v_expected_docs THEN
    RAISE EXCEPTION 'Staged doc count % does not match expected % for run %', v_staged_docs, v_expected_docs, p_run_id;
  END IF;

  IF v_staged_chunks <> v_expected_chunks THEN
    RAISE EXCEPTION 'Staged chunk count % does not match expected % for run %', v_staged_chunks, v_expected_chunks, p_run_id;
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
    staged.id,
    staged.source_title,
    staged.category,
    staged.provenance,
    staged.text,
    staged.principles,
    staged.coaching_moves,
    staged.hierarchy_links,
    staged.pii_risk,
    staged.platform_flag,
    staged.source_hash,
    staged.ingestion_run_id,
    staged.created_at,
    staged.updated_at
  FROM public.brain_doc_staging AS staged
  WHERE staged.ingestion_run_id = p_run_id;

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
    staged.doc_id,
    staged.chunk_index,
    staged.chunk,
    staged.chunk_hash,
    staged.token_estimate,
    staged.embedding_model,
    staged.embedding,
    staged.created_at
  FROM public.brain_chunk_staging AS staged
  WHERE staged.ingestion_run_id = p_run_id;

  DELETE FROM public.brain_chunk_staging
  WHERE ingestion_run_id = p_run_id;
  DELETE FROM public.brain_doc_staging
  WHERE ingestion_run_id = p_run_id;

  RETURN QUERY SELECT v_staged_docs, v_staged_chunks;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.promote_shift_brain_ingestion(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.promote_shift_brain_ingestion(UUID) TO service_role;
