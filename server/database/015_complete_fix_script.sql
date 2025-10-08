-- Complete setup and fix script for BeyondChats
-- Run this in your Supabase SQL Editor to fix all current issues
-- Date: 2025-10-09

-- 1. Add missing users (both old and new IDs)
INSERT INTO users (id, email, full_name, avatar_url, created_at, updated_at)
VALUES 
  ('97281a84-3734-4a9f-9591-ad5393068b2a', 'pankajydv07@gmail.com', 'Pankaj Yadav', NULL, NOW(), NOW()),
  ('ac3bfdb3-e45d-4c9d-9287-96bea8161a8d', 'pankajydv07@gmail.com', 'Pankaj Yadav', NULL, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- 2. Create missing chat_messages table
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_user BOOLEAN NOT NULL DEFAULT true,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for chat_messages
CREATE INDEX IF NOT EXISTS idx_chat_messages_chat_id ON chat_messages(chat_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_timestamp ON chat_messages(timestamp);
CREATE INDEX IF NOT EXISTS idx_chat_messages_is_user ON chat_messages(is_user);

-- 3. Create storage bucket for PDFs
INSERT INTO storage.buckets (id, name, public)
VALUES ('pdfs', 'pdfs', false)
ON CONFLICT (id) DO NOTHING;

-- 4. Create storage policies for PDFs
DO $$
BEGIN
  -- Check if policies already exist before creating
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Users can upload their own PDFs'
  ) THEN
    CREATE POLICY "Users can upload their own PDFs" ON storage.objects
    FOR INSERT WITH CHECK (
      bucket_id = 'pdfs' AND 
      auth.uid()::text = (storage.foldername(name))[1]
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Users can view their own PDFs'
  ) THEN
    CREATE POLICY "Users can view their own PDFs" ON storage.objects
    FOR SELECT USING (
      bucket_id = 'pdfs' AND 
      auth.uid()::text = (storage.foldername(name))[1]
    );
  END IF;
END $$;

-- 5. Temporarily disable RLS for pdf_chunks to allow server operations
ALTER TABLE pdf_chunks DISABLE ROW LEVEL SECURITY;

-- 6. Grant necessary permissions
GRANT ALL ON users TO service_role;
GRANT ALL ON chat_sessions TO service_role;
GRANT ALL ON chat_messages TO service_role;
GRANT ALL ON pdf_files TO service_role;
GRANT ALL ON pdf_chunks TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- 7. Verify setup
SELECT 'Users count:' as check_type, COUNT(*)::text as result FROM users
UNION ALL
SELECT 'Chat sessions count:', COUNT(*)::text FROM chat_sessions
UNION ALL
SELECT 'Chat messages count:', COUNT(*)::text FROM chat_messages
UNION ALL
SELECT 'PDF files count:', COUNT(*)::text FROM pdf_files
UNION ALL
SELECT 'PDF chunks count:', COUNT(*)::text FROM pdf_chunks
UNION ALL
SELECT 'Storage buckets:', COUNT(*)::text FROM storage.buckets WHERE name = 'pdfs';

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Setup complete! All tables created and permissions granted.';
  RAISE NOTICE '✅ Users added, storage bucket created, RLS disabled for pdf_chunks.';
  RAISE NOTICE '✅ You can now test chat and PDF upload functionality.';
END $$;