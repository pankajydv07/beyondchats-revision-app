-- Temporarily disable RLS for pdf_chunks to allow server-side operations
-- This can be re-enabled once RLS policies are properly tested

ALTER TABLE pdf_chunks DISABLE ROW LEVEL SECURITY;

-- Note: To re-enable RLS later, run:
-- ALTER TABLE pdf_chunks ENABLE ROW LEVEL SECURITY;