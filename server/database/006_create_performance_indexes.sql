-- Migration: 006_create_performance_indexes
-- Description: Create additional indexes for query performance optimization
-- Date: 2025-10-08

-- Additional composite indexes for common query patterns

-- Chat sessions performance indexes
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_updated ON chat_sessions(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_pdf_updated ON chat_sessions(pdf_id, updated_at DESC) WHERE pdf_id IS NOT NULL;

-- Quiz attempts performance indexes  
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_user_created ON quiz_attempts(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_user_score ON quiz_attempts(user_id, percentage DESC);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_topic_score ON quiz_attempts(topic, percentage DESC) WHERE topic IS NOT NULL;

-- PDF chunks performance indexes
CREATE INDEX IF NOT EXISTS idx_pdf_chunks_user_created ON pdf_chunks(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pdf_chunks_pdf_page_chunk ON pdf_chunks(pdf_id, page, chunk_index);

-- PDF files performance indexes
CREATE INDEX IF NOT EXISTS idx_pdf_files_user_name ON pdf_files(user_id, file_name);
CREATE INDEX IF NOT EXISTS idx_pdf_files_status_created ON pdf_files(processing_status, created_at DESC);

-- Text search indexes for better text search performance
CREATE INDEX IF NOT EXISTS idx_chat_sessions_title_text ON chat_sessions USING GIN (to_tsvector('english', title)) WHERE title IS NOT NULL;

-- Partial indexes for active/recent data  
-- Note: Cannot use NOW() in index predicates as it's not immutable
-- Alternative approaches for time-based optimization:
-- 1. Use application-level filtering with regular indexes
-- 2. Create scheduled maintenance to rebuild time-based partial indexes
-- 3. Use materialized views for recent data aggregations
-- 
-- Example of manual time-based index (update date as needed):
-- CREATE INDEX idx_recent_chat_sessions_2025 ON chat_sessions(user_id, updated_at DESC) 
--   WHERE updated_at > '2025-01-01'::timestamptz;
--
-- CREATE INDEX IF NOT EXISTS idx_recent_chat_sessions ON chat_sessions(user_id, updated_at DESC) 
--   WHERE updated_at > NOW() - INTERVAL '30 days';

-- CREATE INDEX IF NOT EXISTS idx_recent_quiz_attempts ON quiz_attempts(user_id, created_at DESC) 
--   WHERE created_at > NOW() - INTERVAL '30 days';

CREATE INDEX IF NOT EXISTS idx_completed_pdfs ON pdf_files(user_id, created_at DESC) 
  WHERE processing_status = 'completed';

-- Comments for documentation
COMMENT ON INDEX idx_chat_sessions_user_updated IS 'Optimizes user chat history queries';
COMMENT ON INDEX idx_quiz_attempts_user_score IS 'Optimizes user performance analytics queries';
COMMENT ON INDEX idx_pdf_chunks_pdf_page_chunk IS 'Optimizes PDF navigation and chunking queries';
-- COMMENT ON INDEX idx_recent_chat_sessions IS 'Partial index for recent chat sessions (30 days)';
COMMENT ON INDEX idx_completed_pdfs IS 'Partial index for successfully processed PDFs';