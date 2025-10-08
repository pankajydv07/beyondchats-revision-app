-- Migration: 014_create_chat_messages_table
-- Description: Create chat_messages table that the server expects for individual messages
-- Date: 2025-10-09

-- Create chat_messages table for individual chat messages
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_user BOOLEAN NOT NULL DEFAULT true,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_chat_messages_chat_id ON chat_messages(chat_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_timestamp ON chat_messages(timestamp);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_chat_messages_is_user ON chat_messages(is_user);

-- Comments for documentation
COMMENT ON TABLE chat_messages IS 'Individual chat messages linked to chat sessions';
COMMENT ON COLUMN chat_messages.id IS 'Unique message identifier';
COMMENT ON COLUMN chat_messages.chat_id IS 'Reference to the chat session this message belongs to';
COMMENT ON COLUMN chat_messages.content IS 'The actual message content/text';
COMMENT ON COLUMN chat_messages.is_user IS 'Whether this message is from user (true) or AI (false)';
COMMENT ON COLUMN chat_messages.timestamp IS 'When the message was created/sent';
COMMENT ON COLUMN chat_messages.created_at IS 'Database creation timestamp';

-- Grant permissions to service role
GRANT ALL ON chat_messages TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;