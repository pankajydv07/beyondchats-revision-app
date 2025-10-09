-- Migration script to add metadata column for enhanced page citations
-- Run this in your Supabase SQL Editor

-- Add metadata column to store additional page information
ALTER TABLE pdf_chunks 
ADD COLUMN IF NOT EXISTS metadata JSONB;

-- Create index on metadata for better performance
CREATE INDEX IF NOT EXISTS idx_pdf_chunks_metadata ON pdf_chunks USING GIN (metadata);

-- Drop existing functions first (required when changing return types)
-- Drop all possible variants to avoid function overloading conflicts
DROP FUNCTION IF EXISTS search_pdf_chunks(VECTOR, TEXT, FLOAT, INT);
DROP FUNCTION IF EXISTS search_pdf_chunks(VECTOR, TEXT, UUID, FLOAT, INT);
DROP FUNCTION IF EXISTS get_pdf_chunks(TEXT);

-- Update the search function to return metadata
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
  similarity FLOAT,
  metadata JSONB
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
    (pc.embedding <=> query_embedding) * -1 + 1 AS similarity,
    pc.metadata
  FROM pdf_chunks pc
  WHERE 
    pc.pdf_id = pdf_id_filter
    AND (pc.embedding <=> query_embedding) < (1 - match_threshold)
  ORDER BY pc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Update get_pdf_chunks function to include metadata
CREATE OR REPLACE FUNCTION get_pdf_chunks(pdf_id_filter TEXT)
RETURNS TABLE (
  id BIGINT,
  pdf_id TEXT,
  page INTEGER,
  text TEXT,
  chunk_index INTEGER,
  created_at TIMESTAMPTZ,
  metadata JSONB
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
    pc.created_at,
    pc.metadata
  FROM pdf_chunks pc
  WHERE pc.pdf_id = pdf_id_filter
  ORDER BY pc.chunk_index;
END;
$$;

-- Backfill existing records with default metadata
UPDATE pdf_chunks 
SET metadata = jsonb_build_object(
  'pageRange', page::text,
  'estimationMethod', 'legacy',
  'confidence', 'medium'
)
WHERE metadata IS NULL;

COMMENT ON COLUMN pdf_chunks.metadata IS 'Stores additional information including pageRange (for spans like "2-3"), estimationMethod (pattern_based/distribution_based), confidence level, and character positions';