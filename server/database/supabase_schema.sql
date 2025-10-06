-- Supabase database schema for BeyondChats PDF Embeddings
-- Run this SQL in your Supabase SQL Editor to set up the required tables

-- Enable the vector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create the pdf_chunks table
CREATE TABLE IF NOT EXISTS pdf_chunks (
  id BIGSERIAL PRIMARY KEY,
  pdf_id TEXT NOT NULL,
  page INTEGER NOT NULL,
  text TEXT NOT NULL,
  embedding VECTOR(4096), -- Qwen3-Embedding-8B produces 4096-dimensional vectors
  chunk_index INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_pdf_chunks_pdf_id ON pdf_chunks(pdf_id);
CREATE INDEX IF NOT EXISTS idx_pdf_chunks_page ON pdf_chunks(page);
CREATE INDEX IF NOT EXISTS idx_pdf_chunks_created_at ON pdf_chunks(created_at);

-- Create vector similarity search function
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
    1 - (pc.embedding <=> query_embedding) AS similarity
  FROM pdf_chunks pc
  WHERE pc.pdf_id = pdf_id_filter
    AND 1 - (pc.embedding <=> query_embedding) > match_threshold
  ORDER BY pc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Optional: Create a function to get all chunks for a PDF (for debugging)
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

-- Optional: Create a function to delete all chunks for a PDF
CREATE OR REPLACE FUNCTION delete_pdf_chunks(pdf_id_filter TEXT)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM pdf_chunks WHERE pdf_id = pdf_id_filter;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- Row Level Security (RLS) - Optional but recommended
-- ALTER TABLE pdf_chunks ENABLE ROW LEVEL SECURITY;

-- Create policy for authenticated users (adjust as needed)
-- CREATE POLICY "Users can manage their own PDF chunks" ON pdf_chunks
--   FOR ALL TO authenticated
--   USING (true)
--   WITH CHECK (true);

-- Grant permissions to authenticated users
-- GRANT ALL ON pdf_chunks TO authenticated;
-- GRANT USAGE ON SEQUENCE pdf_chunks_id_seq TO authenticated;

-- Example usage queries:
-- 
-- 1. Insert a test chunk:
-- INSERT INTO pdf_chunks (pdf_id, page, text, chunk_index) 
-- VALUES ('test_pdf', 1, 'This is a test chunk', 0);
--
-- 2. Search for similar chunks (requires actual embedding):
-- SELECT * FROM search_pdf_chunks(
--   '[0.1, 0.2, 0.3, ...]'::vector, -- Your query embedding
--   'test_pdf',
--   0.1,
--   5
-- );
--
-- 3. Get all chunks for a PDF:
-- SELECT * FROM get_pdf_chunks('test_pdf');
--
-- 4. Delete all chunks for a PDF:
-- SELECT delete_pdf_chunks('test_pdf');