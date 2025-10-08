-- Fix RLS policies for PDF chunks
-- Run this in your Supabase SQL Editor

-- First, disable RLS temporarily to fix any existing data issues
ALTER TABLE pdf_chunks DISABLE ROW LEVEL SECURITY;

-- Re-enable RLS with updated policies
ALTER TABLE pdf_chunks ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own PDF chunks" ON pdf_chunks;
DROP POLICY IF EXISTS "Users can insert own PDF chunks" ON pdf_chunks;
DROP POLICY IF EXISTS "Users can update own PDF chunks" ON pdf_chunks;
DROP POLICY IF EXISTS "Users can delete own PDF chunks" ON pdf_chunks;
DROP POLICY IF EXISTS "Service role can access all PDF chunks" ON pdf_chunks;

-- Create new policies that work better with server-side operations
-- Allow authenticated users to access their own PDF chunks
CREATE POLICY "Users can view own PDF chunks" ON pdf_chunks
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own PDF chunks" ON pdf_chunks
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own PDF chunks" ON pdf_chunks
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own PDF chunks" ON pdf_chunks
  FOR DELETE USING (auth.uid() = user_id);

-- Allow service role to bypass RLS completely for server-side operations
-- This is needed for background PDF processing
CREATE POLICY "Service role can access all PDF chunks" ON pdf_chunks
  FOR ALL USING (
    current_setting('request.jwt.claims', true)::json->>'role' = 'service_role' OR
    current_setting('role') = 'service_role' OR
    current_user = 'service_role' OR
    current_user = 'postgres'
  );

-- Grant necessary permissions
GRANT ALL ON pdf_chunks TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- For debugging: you can temporarily disable RLS on pdf_chunks if issues persist
-- ALTER TABLE pdf_chunks DISABLE ROW LEVEL SECURITY;