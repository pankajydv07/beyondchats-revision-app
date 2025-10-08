-- Migration: 007_create_rls_policies
-- Description: Create Row Level Security (RLS) policies for data protection
-- Date: 2025-10-08
--
-- IMPORTANT: This migration assumes Supabase Auth is properly configured
-- If auth.uid() doesn't work, uncomment the alternative policies at the bottom
-- For server-side operations, ensure you're using the service role key

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE pdf_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE pdf_files ENABLE ROW LEVEL SECURITY;

-- Users table policies
-- Users can view and update their own profile
CREATE POLICY "Users can view own profile" ON users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON users
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Chat sessions policies
-- Users can only access their own chat sessions
CREATE POLICY "Users can view own chat sessions" ON chat_sessions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own chat sessions" ON chat_sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own chat sessions" ON chat_sessions
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own chat sessions" ON chat_sessions
  FOR DELETE USING (auth.uid() = user_id);

-- Quiz attempts policies
-- Users can only access their own quiz attempts
CREATE POLICY "Users can view own quiz attempts" ON quiz_attempts
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own quiz attempts" ON quiz_attempts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own quiz attempts" ON quiz_attempts
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own quiz attempts" ON quiz_attempts
  FOR DELETE USING (auth.uid() = user_id);

-- PDF chunks policies
-- Users can only access chunks from their own PDFs
CREATE POLICY "Users can view own PDF chunks" ON pdf_chunks
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own PDF chunks" ON pdf_chunks
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own PDF chunks" ON pdf_chunks
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own PDF chunks" ON pdf_chunks
  FOR DELETE USING (auth.uid() = user_id);

-- PDF files policies
-- Users can only access their own uploaded PDF files
CREATE POLICY "Users can view own PDF files" ON pdf_files
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own PDF files" ON pdf_files
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own PDF files" ON pdf_files
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own PDF files" ON pdf_files
  FOR DELETE USING (auth.uid() = user_id);

-- Service role policies (for server-side operations)
-- Allow service role to bypass RLS for admin operations
-- Note: Using a more reliable approach to detect service role
CREATE POLICY "Service role can access all users" ON users
  FOR ALL USING (
    current_setting('role') = 'service_role' OR
    current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
  );

CREATE POLICY "Service role can access all chat sessions" ON chat_sessions
  FOR ALL USING (
    current_setting('role') = 'service_role' OR
    current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
  );

CREATE POLICY "Service role can access all quiz attempts" ON quiz_attempts
  FOR ALL USING (
    current_setting('role') = 'service_role' OR
    current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
  );

CREATE POLICY "Service role can access all PDF chunks" ON pdf_chunks
  FOR ALL USING (
    current_setting('role') = 'service_role' OR
    current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
  );

CREATE POLICY "Service role can access all PDF files" ON pdf_files
  FOR ALL USING (
    current_setting('role') = 'service_role' OR
    current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
  );

-- Create helper functions for common RLS patterns in public schema
-- Note: Cannot create functions in auth schema due to permission restrictions
CREATE OR REPLACE FUNCTION public.get_current_user_id() 
RETURNS UUID 
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT COALESCE(
    (current_setting('request.jwt.claims', true)::json->>'sub')::uuid,
    (current_setting('request.jwt.claims', true)::json->>'user_id')::uuid
  );
$$;

-- Alternative policies using the helper function (commented out - use if auth.uid() doesn't work)
/*
CREATE POLICY "Users can view own profile (alt)" ON users
  FOR SELECT USING (public.get_current_user_id() = id);

CREATE POLICY "Users can view own chat sessions (alt)" ON chat_sessions
  FOR SELECT USING (public.get_current_user_id() = user_id);

CREATE POLICY "Users can view own quiz attempts (alt)" ON quiz_attempts
  FOR SELECT USING (public.get_current_user_id() = user_id);

CREATE POLICY "Users can view own PDF chunks (alt)" ON pdf_chunks
  FOR SELECT USING (public.get_current_user_id() = user_id);

CREATE POLICY "Users can view own PDF files (alt)" ON pdf_files
  FOR SELECT USING (public.get_current_user_id() = user_id);
*/

-- Comments for documentation
COMMENT ON POLICY "Users can view own profile" ON users IS 'Allows users to view their own profile data';
COMMENT ON POLICY "Users can view own chat sessions" ON chat_sessions IS 'Restricts chat session access to owners only';
COMMENT ON POLICY "Users can view own quiz attempts" ON quiz_attempts IS 'Restricts quiz attempt access to owners only';
COMMENT ON POLICY "Users can view own PDF chunks" ON pdf_chunks IS 'Restricts PDF chunk access to owners only';
COMMENT ON POLICY "Users can view own PDF files" ON pdf_files IS 'Restricts PDF file access to owners only';
COMMENT ON POLICY "Service role can access all users" ON users IS 'Allows server-side operations with service role';

-- Create a function to check if current user can access a specific PDF
CREATE OR REPLACE FUNCTION user_can_access_pdf(pdf_file_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM pdf_files 
    WHERE id = pdf_file_id 
    AND user_id = auth.uid()
  );
$$;

COMMENT ON FUNCTION user_can_access_pdf IS 'Helper function to check PDF access permissions';
COMMENT ON FUNCTION public.get_current_user_id IS 'Helper function to get current user ID from JWT claims - alternative to auth.uid()';