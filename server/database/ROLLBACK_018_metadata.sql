-- ROLLBACK SCRIPT for 018_add_metadata_for_citations.sql
-- Use this if you need to completely undo the migration

-- Drop the functions that include metadata
DROP FUNCTION IF EXISTS search_pdf_chunks(VECTOR, TEXT, FLOAT, INT);
DROP FUNCTION IF EXISTS get_pdf_chunks(TEXT);

-- Remove the metadata column and its index
DROP INDEX IF EXISTS idx_pdf_chunks_metadata;
ALTER TABLE pdf_chunks DROP COLUMN IF EXISTS metadata;

-- Recreate the original search function (without metadata)
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

-- Recreate the original get_pdf_chunks function (without metadata)
CREATE OR REPLACE FUNCTION get_pdf_chunks(pdf_id_filter TEXT)
RETURNS TABLE (
  id BIGINT,
  pdf_id TEXT,
  page INTEGER,
  text TEXT,
  chunk_index INTEGER,
  created_at TIMESTAMPTZ
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
    pc.created_at
  FROM pdf_chunks pc
  WHERE pc.pdf_id = pdf_id_filter
  ORDER BY pc.chunk_index;
END;
$$;

-- Note: This rollback script restores the database to its original state
-- Any data stored in the metadata column will be lost