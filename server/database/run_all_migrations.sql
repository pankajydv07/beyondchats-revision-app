-- Master Migration Script
-- Description: Run all database migrations in the correct order
-- Date: 2025-10-08
-- 
-- Usage: Run this script in your Supabase SQL Editor to set up the complete database schema
--
-- IMPORTANT: 
-- 1. This will modify your database structure
-- 2. Make sure to backup your data before running
-- 3. Run each migration separately if you need more control

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS vector;

-- Migration 001: Create users table
\i 001_create_users_table.sql

-- Migration 002: Create chat_sessions table  
\i 002_create_chat_sessions_table.sql

-- Migration 003: Create quiz_attempts table
\i 003_create_quiz_attempts_table.sql

-- Migration 004: Update pdf_chunks table
\i 004_update_pdf_chunks_table.sql

-- Migration 005: Create pdf_files table
\i 005_create_pdf_files_table.sql

-- Migration 006: Create performance indexes
\i 006_create_performance_indexes.sql

-- Migration 007: Create RLS policies
\i 007_create_rls_policies.sql

-- Verify migration completion
DO $$
BEGIN
  RAISE NOTICE 'Checking migration completion...';
  
  -- Check if all tables exist
  IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'users') THEN
    RAISE EXCEPTION 'Migration failed: users table not found';
  END IF;
  
  IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'chat_sessions') THEN
    RAISE EXCEPTION 'Migration failed: chat_sessions table not found';
  END IF;
  
  IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'quiz_attempts') THEN
    RAISE EXCEPTION 'Migration failed: quiz_attempts table not found';
  END IF;
  
  IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'pdf_chunks') THEN
    RAISE EXCEPTION 'Migration failed: pdf_chunks table not found';
  END IF;
  
  IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'pdf_files') THEN
    RAISE EXCEPTION 'Migration failed: pdf_files table not found';
  END IF;
  
  RAISE NOTICE '✅ All migrations completed successfully!';
  RAISE NOTICE 'Database schema is ready for BeyondChats application.';
END $$;