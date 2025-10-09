-- Migration: 016_fix_users_table_id
-- Description: Fix users table to use Supabase Auth user IDs instead of auto-generated UUIDs
-- Date: 2025-10-09

-- First, drop the existing trigger and function if they exist
DROP TRIGGER IF EXISTS update_users_updated_at ON users;

-- Remove the default UUID generation from the id column
ALTER TABLE users ALTER COLUMN id DROP DEFAULT;

-- Ensure the id column is of type UUID (it should already be, but let's be explicit)
-- ALTER TABLE users ALTER COLUMN id TYPE UUID USING id::UUID;

-- Recreate the trigger for updated_at
CREATE TRIGGER update_users_updated_at 
    BEFORE UPDATE ON users 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Update the comment
COMMENT ON COLUMN users.id IS 'Supabase Auth user identifier (must match auth.users.id)';

-- Add a constraint to ensure the ID is provided (no more auto-generation)
-- This is implicit since we removed the DEFAULT, but let's be clear about it
ALTER TABLE users ALTER COLUMN id SET NOT NULL;