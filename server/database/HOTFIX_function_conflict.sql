-- Quick hotfix for function overloading conflict
-- Run this immediately in Supabase SQL Editor to fix the search error

-- Drop ALL variants of the search function to resolve conflict
DROP FUNCTION IF EXISTS search_pdf_chunks(VECTOR, TEXT, FLOAT, INT);
DROP FUNCTION IF EXISTS search_pdf_chunks(VECTOR, TEXT, UUID, FLOAT, INT);

-- Recreate with the standard signature (without metadata for now)
CREATE OR REPLACE FUNCTION search_pdf_chunks(
  query_embedding VECTOR(4096),
  pdf_id_filter TEXT,
  match_threshold FLOAT DEFAULT 0.1,
  match_count INT DEFAULT 5
)
RETURNS TABLE (
  id BIGINT,
  pdf_id TEXT,
  page INTEGER,
  text TEXT,
  chunk_index INTEGER,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pc.id,
    pc.pdf_id,
    pc.page,
    pc.text,
    pc.chunk_index,
    (pc.embedding <=> query_embedding) * -1 + 1 AS similarity
  FROM pdf_chunks pc
  WHERE 
    pc.pdf_id = pdf_id_filter
    AND (pc.embedding <=> query_embedding) < (1 - match_threshold)
  ORDER BY pc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;