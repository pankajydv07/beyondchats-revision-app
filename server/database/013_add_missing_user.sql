-- Quick fix to add the missing user to the users table
-- Replace the UUID with the actual user ID from your error logs

-- Insert the user that was causing the foreign key error (old user)
INSERT INTO users (id, email, full_name, avatar_url, created_at, updated_at)
VALUES (
  '97281a84-3734-4a9f-9591-ad5393068b2a', 
  'pankajydv07@gmail.com',
  'Pankaj Yadav',
  NULL,
  NOW(),
  NOW()
) ON CONFLICT (id) DO NOTHING;

-- Insert the NEW user that was causing the foreign key error
INSERT INTO users (id, email, full_name, avatar_url, created_at, updated_at)
VALUES (
  'ac3bfdb3-e45d-4c9d-9287-96bea8161a8d', 
  'pankajydv07@gmail.com',
  'Pankaj Yadav',
  NULL,
  NOW(),
  NOW()
) ON CONFLICT (id) DO NOTHING;

-- Verify the user was created
SELECT id, email, full_name, created_at FROM users WHERE id = '97281a84-3734-4a9f-9591-ad5393068b2a';

-- Also check the current state of tables
SELECT COUNT(*) as total_users FROM users;
SELECT COUNT(*) as total_pdfs FROM pdf_files;
SELECT COUNT(*) as total_chunks FROM pdf_chunks;