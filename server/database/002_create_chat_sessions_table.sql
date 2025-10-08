-- Migration: 002_create_chat_sessions_table
-- Description: Create chat_sessions table for storing user chat history
-- Date: 2025-10-08

-- Create chat_sessions table
CREATE TABLE IF NOT EXISTS chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT,
  pdf_id TEXT,
  messages JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_id ON chat_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_pdf_id ON chat_sessions(pdf_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_created_at ON chat_sessions(created_at);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_updated_at ON chat_sessions(updated_at);

-- Create GIN index for JSONB messages for efficient querying
CREATE INDEX IF NOT EXISTS idx_chat_sessions_messages ON chat_sessions USING GIN (messages);

-- Create trigger to automatically update updated_at timestamp
CREATE TRIGGER update_chat_sessions_updated_at 
    BEFORE UPDATE ON chat_sessions 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Add constraints for data validation
ALTER TABLE chat_sessions ADD CONSTRAINT check_messages_is_array 
  CHECK (jsonb_typeof(messages) = 'array');

-- Comments for documentation
COMMENT ON TABLE chat_sessions IS 'User chat sessions with PDF context';
COMMENT ON COLUMN chat_sessions.id IS 'Unique chat session identifier';
COMMENT ON COLUMN chat_sessions.user_id IS 'Reference to the user who owns this chat session';
COMMENT ON COLUMN chat_sessions.title IS 'User-defined or auto-generated chat title';
COMMENT ON COLUMN chat_sessions.pdf_id IS 'Reference to the PDF being discussed in this chat';
COMMENT ON COLUMN chat_sessions.messages IS 'Array of chat messages in JSON format';
COMMENT ON COLUMN chat_sessions.created_at IS 'Chat session creation timestamp';
COMMENT ON COLUMN chat_sessions.updated_at IS 'Last message/update timestamp';