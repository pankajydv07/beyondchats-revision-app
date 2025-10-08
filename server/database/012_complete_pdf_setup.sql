-- Complete setup script for BeyondChats PDF functionality
-- Run this in your Supabase SQL Editor to set up storage and fix RLS issues

-- 1. Create storage bucket for PDF files
INSERT INTO storage.buckets (id, name, public)
VALUES ('pdfs', 'pdfs', false)
ON CONFLICT (id) DO NOTHING;

-- 2. Create storage policies for pdfs bucket
CREATE POLICY "Users can upload their own PDFs" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'pdfs' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view their own PDFs" ON storage.objects
FOR SELECT USING (
  bucket_id = 'pdfs' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can update their own PDFs" ON storage.objects
FOR UPDATE USING (
  bucket_id = 'pdfs' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own PDFs" ON storage.objects
FOR DELETE USING (
  bucket_id = 'pdfs' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

-- 3. Temporarily disable RLS for pdf_chunks to allow server operations
ALTER TABLE pdf_chunks DISABLE ROW LEVEL SECURITY;

-- 4. Grant permissions to service role
GRANT ALL ON pdf_chunks TO service_role;
GRANT ALL ON pdf_files TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- 5. Verify the setup
SELECT 
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables 
WHERE tablename IN ('pdf_chunks', 'pdf_files')
  AND schemaname = 'public';

SELECT name, public FROM storage.buckets WHERE name = 'pdfs';

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Setup complete! Storage bucket created and RLS temporarily disabled for pdf_chunks.';
  RAISE NOTICE 'You can now test PDF upload functionality.';
END $$;