# Database Migrations for BeyondChats

This directory contains SQL migration files to set up the complete database schema for the BeyondChats application.

## Overview

The database schema includes the following tables:
- **users** - User accounts and profiles
- **chat_sessions** - User chat sessions with PDF context
- **quiz_attempts** - Quiz performance tracking
- **pdf_chunks** - PDF text chunks with vector embeddings
- **pdf_files** - Uploaded PDF file metadata

## Migration Files

| File | Description |
|------|-------------|
| `001_create_users_table.sql` | Creates users table with authentication fields |
| `002_create_chat_sessions_table.sql` | Creates chat sessions table with JSONB message storage |
| `003_create_quiz_attempts_table.sql` | Creates quiz attempts table with scoring and analytics |
| `004_update_pdf_chunks_table.sql` | Updates pdf_chunks table with user relationships and improved indexing |
| `005_create_pdf_files_table.sql` | Creates pdf_files table for file management |
| `006_create_performance_indexes.sql` | Creates additional indexes for query optimization |
| `007_create_rls_policies.sql` | Creates Row Level Security policies for data protection |
| `run_all_migrations.sql` | Master script to run all migrations in order |

## Running Migrations

### Option 1: Run All Migrations (Recommended for new setups)
```sql
-- In Supabase SQL Editor, run:
-- Copy and paste the contents of run_all_migrations.sql
```

### Option 2: Run Individual Migrations
Run each migration file in order:
1. `001_create_users_table.sql`
2. `002_create_chat_sessions_table.sql`
3. `003_create_quiz_attempts_table.sql`
4. `004_update_pdf_chunks_table.sql`
5. `005_create_pdf_files_table.sql`
6. `006_create_performance_indexes.sql`
7. `007_create_rls_policies.sql`

## Prerequisites

- Supabase project with PostgreSQL database
- `uuid-ossp` extension (auto-enabled in migrations)
- `vector` extension for embeddings (auto-enabled in migrations)

## Important Notes

### For Existing Data
- Migration 004 backs up existing `pdf_chunks` data before restructuring
- Review backup data after migration completion
- Existing embeddings will need to be re-associated with users

### Vector Indexing Considerations
- **4096-dimensional vectors**: Using Qwen3-Embedding-8B model
- **No HNSW index**: HNSW has a 2000-dimension limit, incompatible with 4096-dim vectors
- **Sequential scan**: PostgreSQL uses built-in vector operators for similarity search
- **Performance**: For moderate datasets (<100K chunks), sequential scan is acceptable
- **Alternative**: Consider reducing embedding dimensions or using approximate methods for larger datasets

### Environment Variables Required
Make sure your application has these environment variables set:
```bash
SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_KEY=your_supabase_service_role_key
SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Row Level Security (RLS)
- All tables have RLS enabled for security
- Users can only access their own data
- Server operations use service role to bypass RLS when needed
- Anonymous access is not allowed

## Schema Highlights

### Vector Search
- 4096-dimensional embeddings (Qwen3-Embedding-8B)
- Sequential scan with cosine distance operators (HNSW index limited to 2000 dimensions)
- Configurable similarity thresholds
- Built-in PostgreSQL vector operations for exact similarity search

### Performance Optimizations
- Composite indexes for common query patterns
- Partial indexes for recent data
- GIN indexes for JSONB fields
- Text search indexes for full-text search

### Data Integrity
- Foreign key constraints with cascade deletes
- Check constraints for data validation
- Automatic timestamp updates
- Computed percentage scores for quizzes

## Verification

After running migrations, verify the setup:

```sql
-- Check table creation
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- Check RLS policies
SELECT tablename, policyname, cmd, roles 
FROM pg_policies 
WHERE schemaname = 'public';

-- Check indexes
SELECT tablename, indexname, indexdef 
FROM pg_indexes 
WHERE schemaname = 'public' 
ORDER BY tablename, indexname;
```

## Rollback

If you need to rollback the migrations:

```sql
-- WARNING: This will delete all data!
DROP TABLE IF EXISTS pdf_chunks CASCADE;
DROP TABLE IF EXISTS pdf_files CASCADE;
DROP TABLE IF EXISTS quiz_attempts CASCADE;
DROP TABLE IF EXISTS chat_sessions CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Drop functions
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;
DROP FUNCTION IF EXISTS search_pdf_chunks(vector, text, uuid, float, int) CASCADE;
DROP FUNCTION IF EXISTS update_pdf_chunk_count() CASCADE;
DROP FUNCTION IF EXISTS user_can_access_pdf(uuid) CASCADE;
DROP FUNCTION IF EXISTS auth.user_id() CASCADE;
```

## Support

For issues with migrations:
1. Check Supabase logs for detailed error messages
2. Ensure all required extensions are enabled
3. Verify sufficient database permissions
4. Review the migration order dependencies

---

**Last Updated**: October 8, 2025
**Compatible with**: Supabase PostgreSQL 15+