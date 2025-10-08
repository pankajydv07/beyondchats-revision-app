-- Migration: 004_update_pdf_chunks_table
-- Description: Update pdf_chunks table to add user relationship and improve structure
-- Date: 2025-10-08

-- Enable vector extension if not already enabled
CREATE EXTENSION IF NOT EXISTS vector;

-- First, check if the table exists and backup data if needed
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'pdf_chunks') THEN
    -- Create backup table
    CREATE TABLE IF NOT EXISTS pdf_chunks_backup AS SELECT * FROM pdf_chunks;
    RAISE NOTICE 'Created backup of existing pdf_chunks table';
  END IF;
END $$;

-- Drop the old table if it exists (after backup)
DROP TABLE IF EXISTS pdf_chunks CASCADE;

-- Create the new pdf_chunks table with user relationship
CREATE TABLE pdf_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pdf_id TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  page INTEGER NOT NULL,
  text TEXT NOT NULL,
  embedding VECTOR(4096), -- Qwen3-Embedding-8B produces 4096-dimensional vectors
  chunk_index INTEGER,
  metadata JSONB DEFAULT '{}'::jsonb, -- Additional metadata like heading, font size, etc.
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_pdf_chunks_pdf_id ON pdf_chunks(pdf_id);
CREATE INDEX IF NOT EXISTS idx_pdf_chunks_user_id ON pdf_chunks(user_id);
CREATE INDEX IF NOT EXISTS idx_pdf_chunks_page ON pdf_chunks(page);
CREATE INDEX IF NOT EXISTS idx_pdf_chunks_chunk_index ON pdf_chunks(chunk_index);
CREATE INDEX IF NOT EXISTS idx_pdf_chunks_created_at ON pdf_chunks(created_at);

-- Note: HNSW index has a limit of 2000 dimensions, but we use 4096-dimensional vectors
-- For 4096 dimensions, we rely on built-in vector operations without specialized indexing
-- This maintains compatibility with the original schema approach and avoids the dimension limit error
-- PostgreSQL will use sequential scan with vector distance operators (<=> for cosine distance)
-- For smaller datasets, this is often sufficient and avoids index maintenance overhead
-- CREATE INDEX IF NOT EXISTS idx_pdf_chunks_embedding_hnsw ON pdf_chunks 
--   USING hnsw (embedding vector_cosine_ops) 
--   WITH (m = 16, ef_construction = 64);

-- Create GIN index for metadata JSONB
CREATE INDEX IF NOT EXISTS idx_pdf_chunks_metadata ON pdf_chunks USING GIN (metadata);

-- Create composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_pdf_chunks_user_pdf ON pdf_chunks(user_id, pdf_id);
CREATE INDEX IF NOT EXISTS idx_pdf_chunks_pdf_page ON pdf_chunks(pdf_id, page);

-- Drop existing function if it exists (handles signature changes)
DROP FUNCTION IF EXISTS search_pdf_chunks(VECTOR, TEXT, FLOAT, INT);
DROP FUNCTION IF EXISTS search_pdf_chunks(VECTOR, TEXT, UUID, FLOAT, INT);
DROP FUNCTION IF EXISTS search_pdf_chunks;

-- Create or replace the vector similarity search function
CREATE OR REPLACE FUNCTION search_pdf_chunks(
  query_embedding VECTOR(4096),
  pdf_id_filter TEXT DEFAULT NULL,
  user_id_filter UUID DEFAULT NULL,
  match_threshold FLOAT DEFAULT 0.1,
  match_count INT DEFAULT 5
)
RETURNS TABLE (
  id UUID,
  pdf_id TEXT,
  user_id UUID,
  page INTEGER,
  text TEXT,
  chunk_index INTEGER,
  metadata JSONB,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    pc.id,
    pc.pdf_id,
    pc.user_id,
    pc.page,
    pc.text,
    pc.chunk_index,
    pc.metadata,
    1 - (pc.embedding <=> query_embedding) AS similarity
  FROM pdf_chunks pc
  WHERE 
    (pdf_id_filter IS NULL OR pc.pdf_id = pdf_id_filter)
    AND (user_id_filter IS NULL OR pc.user_id = user_id_filter)
    AND pc.embedding IS NOT NULL
    AND 1 - (pc.embedding <=> query_embedding) > match_threshold
  ORDER BY pc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Add constraints for data validation
ALTER TABLE pdf_chunks ADD CONSTRAINT check_page_positive 
  CHECK (page > 0);

ALTER TABLE pdf_chunks ADD CONSTRAINT check_chunk_index_non_negative 
  CHECK (chunk_index IS NULL OR chunk_index >= 0);

ALTER TABLE pdf_chunks ADD CONSTRAINT check_text_not_empty 
  CHECK (LENGTH(TRIM(text)) > 0);

-- Comments for documentation
COMMENT ON TABLE pdf_chunks IS 'PDF text chunks with vector embeddings for semantic search';
COMMENT ON COLUMN pdf_chunks.id IS 'Unique chunk identifier';
COMMENT ON COLUMN pdf_chunks.pdf_id IS 'Reference to the source PDF file';
COMMENT ON COLUMN pdf_chunks.user_id IS 'Reference to the user who owns this PDF';
COMMENT ON COLUMN pdf_chunks.page IS 'Page number in the source PDF';
COMMENT ON COLUMN pdf_chunks.text IS 'Text content of the chunk';
COMMENT ON COLUMN pdf_chunks.embedding IS '4096-dimensional vector embedding';
COMMENT ON COLUMN pdf_chunks.chunk_index IS 'Sequential index of chunk within the PDF';
COMMENT ON COLUMN pdf_chunks.metadata IS 'Additional metadata about the chunk (headings, formatting, etc.)';
COMMENT ON COLUMN pdf_chunks.created_at IS 'Chunk creation timestamp';

COMMENT ON FUNCTION search_pdf_chunks IS 'Performs vector similarity search on PDF chunks with optional filtering';