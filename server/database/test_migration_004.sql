-- Test script for 004_update_pdf_chunks_table migration
-- Run this after the migration to verify everything works correctly

-- Test 1: Check table structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'pdf_chunks' 
ORDER BY ordinal_position;

-- Test 2: Check indexes (should not include HNSW)
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'pdf_chunks'
ORDER BY indexname;

-- Test 3: Test the search function with a dummy embedding
-- Note: This will return empty results but should not error
SELECT * FROM search_pdf_chunks(
  array_fill(0.1, ARRAY[4096])::vector(4096),
  'test_pdf',
  '00000000-0000-0000-0000-000000000000'::uuid,
  0.1,
  5
);

-- Test 4: Check constraints
SELECT conname, consrc 
FROM pg_constraint 
WHERE conrelid = 'pdf_chunks'::regclass
ORDER BY conname;

-- Test 5: Verify vector operations work (should not error)
SELECT 
  '[1,2,3]'::vector(3) <=> '[4,5,6]'::vector(3) as cosine_distance,
  '[1,2,3]'::vector(3) <-> '[4,5,6]'::vector(3) as euclidean_distance;

-- If all tests pass without errors, the migration is successful!