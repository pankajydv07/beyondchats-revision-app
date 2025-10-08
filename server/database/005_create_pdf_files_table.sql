-- Migration: 005_create_pdf_files_table
-- Description: Create pdf_files table for tracking uploaded PDF files
-- Date: 2025-10-08

-- Create pdf_files table
CREATE TABLE IF NOT EXISTS pdf_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  original_name TEXT, -- Original filename when uploaded
  file_url TEXT, -- URL/path to the stored file
  file_size BIGINT, -- File size in bytes
  mime_type TEXT DEFAULT 'application/pdf',
  processing_status TEXT DEFAULT 'pending' CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed')),
  total_pages INTEGER,
  total_chunks INTEGER DEFAULT 0,
  error_message TEXT, -- Error details if processing failed
  metadata JSONB DEFAULT '{}'::jsonb, -- Additional file metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ -- When processing was completed
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_pdf_files_user_id ON pdf_files(user_id);
CREATE INDEX IF NOT EXISTS idx_pdf_files_file_name ON pdf_files(file_name);
CREATE INDEX IF NOT EXISTS idx_pdf_files_processing_status ON pdf_files(processing_status);
CREATE INDEX IF NOT EXISTS idx_pdf_files_created_at ON pdf_files(created_at);
CREATE INDEX IF NOT EXISTS idx_pdf_files_processed_at ON pdf_files(processed_at);

-- Create GIN index for metadata JSONB
CREATE INDEX IF NOT EXISTS idx_pdf_files_metadata ON pdf_files USING GIN (metadata);

-- Create composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_pdf_files_user_status ON pdf_files(user_id, processing_status);
CREATE INDEX IF NOT EXISTS idx_pdf_files_user_created ON pdf_files(user_id, created_at DESC);

-- Create trigger to automatically update updated_at timestamp
CREATE TRIGGER update_pdf_files_updated_at 
    BEFORE UPDATE ON pdf_files 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Add constraints for data validation
ALTER TABLE pdf_files ADD CONSTRAINT check_file_size_positive 
  CHECK (file_size IS NULL OR file_size > 0);

ALTER TABLE pdf_files ADD CONSTRAINT check_total_pages_positive 
  CHECK (total_pages IS NULL OR total_pages > 0);

ALTER TABLE pdf_files ADD CONSTRAINT check_total_chunks_non_negative 
  CHECK (total_chunks >= 0);

ALTER TABLE pdf_files ADD CONSTRAINT check_file_name_not_empty 
  CHECK (LENGTH(TRIM(file_name)) > 0);

-- Create function to update chunk count automatically
CREATE OR REPLACE FUNCTION update_pdf_chunk_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    UPDATE pdf_files 
    SET total_chunks = (
      SELECT COUNT(*) 
      FROM pdf_chunks 
      WHERE pdf_id = NEW.id::TEXT
    )
    WHERE id = NEW.pdf_id::UUID;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE pdf_files 
    SET total_chunks = (
      SELECT COUNT(*) 
      FROM pdf_chunks 
      WHERE pdf_id = OLD.pdf_id
    )
    WHERE id = OLD.pdf_id::UUID;
  END IF;
  
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update chunk count when pdf_chunks are modified
CREATE TRIGGER update_pdf_files_chunk_count
  AFTER INSERT OR UPDATE OR DELETE ON pdf_chunks
  FOR EACH ROW
  EXECUTE FUNCTION update_pdf_chunk_count();

-- Comments for documentation
COMMENT ON TABLE pdf_files IS 'Uploaded PDF files and their processing status';
COMMENT ON COLUMN pdf_files.id IS 'Unique PDF file identifier';
COMMENT ON COLUMN pdf_files.user_id IS 'Reference to the user who uploaded the file';
COMMENT ON COLUMN pdf_files.file_name IS 'Current filename (may be different from original)';
COMMENT ON COLUMN pdf_files.original_name IS 'Original filename when uploaded';
COMMENT ON COLUMN pdf_files.file_url IS 'URL or storage path to the file';
COMMENT ON COLUMN pdf_files.file_size IS 'File size in bytes';
COMMENT ON COLUMN pdf_files.mime_type IS 'MIME type of the file';
COMMENT ON COLUMN pdf_files.processing_status IS 'Current processing status';
COMMENT ON COLUMN pdf_files.total_pages IS 'Number of pages in the PDF';
COMMENT ON COLUMN pdf_files.total_chunks IS 'Number of text chunks extracted';
COMMENT ON COLUMN pdf_files.error_message IS 'Error details if processing failed';
COMMENT ON COLUMN pdf_files.metadata IS 'Additional file metadata (title, author, etc.)';
COMMENT ON COLUMN pdf_files.created_at IS 'File upload timestamp';
COMMENT ON COLUMN pdf_files.updated_at IS 'Last update timestamp';
COMMENT ON COLUMN pdf_files.processed_at IS 'Processing completion timestamp';