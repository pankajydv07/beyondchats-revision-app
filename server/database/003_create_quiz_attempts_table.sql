-- Migration: 003_create_quiz_attempts_table
-- Description: Create quiz_attempts table for tracking user quiz performance
-- Date: 2025-10-08

-- Create quiz_attempts table
CREATE TABLE IF NOT EXISTS quiz_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  quiz_id TEXT NOT NULL,
  topic TEXT,
  score INTEGER NOT NULL DEFAULT 0,
  total INTEGER NOT NULL DEFAULT 0,
  percentage DECIMAL(5,2) GENERATED ALWAYS AS (
    CASE 
      WHEN total > 0 THEN ROUND((score::DECIMAL / total::DECIMAL) * 100, 2)
      ELSE 0 
    END
  ) STORED,
  feedback TEXT,
  quiz_data JSONB, -- Store the complete quiz questions and answers
  user_answers JSONB, -- Store user's answers
  time_taken INTEGER, -- Time taken in seconds
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_user_id ON quiz_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_quiz_id ON quiz_attempts(quiz_id);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_topic ON quiz_attempts(topic);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_score ON quiz_attempts(score);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_percentage ON quiz_attempts(percentage);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_created_at ON quiz_attempts(created_at);

-- Create GIN indexes for JSONB fields
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_quiz_data ON quiz_attempts USING GIN (quiz_data);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_user_answers ON quiz_attempts USING GIN (user_answers);

-- Add constraints for data validation
ALTER TABLE quiz_attempts ADD CONSTRAINT check_score_non_negative 
  CHECK (score >= 0);

ALTER TABLE quiz_attempts ADD CONSTRAINT check_total_positive 
  CHECK (total > 0);

ALTER TABLE quiz_attempts ADD CONSTRAINT check_score_not_greater_than_total 
  CHECK (score <= total);

ALTER TABLE quiz_attempts ADD CONSTRAINT check_time_taken_non_negative 
  CHECK (time_taken IS NULL OR time_taken >= 0);

-- Comments for documentation
COMMENT ON TABLE quiz_attempts IS 'User quiz attempts and performance tracking';
COMMENT ON COLUMN quiz_attempts.id IS 'Unique quiz attempt identifier';
COMMENT ON COLUMN quiz_attempts.user_id IS 'Reference to the user who took the quiz';
COMMENT ON COLUMN quiz_attempts.quiz_id IS 'Identifier for the quiz (can be PDF-based or topic-based)';
COMMENT ON COLUMN quiz_attempts.topic IS 'Subject or topic of the quiz';
COMMENT ON COLUMN quiz_attempts.score IS 'Number of correct answers';
COMMENT ON COLUMN quiz_attempts.total IS 'Total number of questions';
COMMENT ON COLUMN quiz_attempts.percentage IS 'Calculated percentage score';
COMMENT ON COLUMN quiz_attempts.feedback IS 'AI-generated feedback or user notes';
COMMENT ON COLUMN quiz_attempts.quiz_data IS 'Complete quiz questions and correct answers';
COMMENT ON COLUMN quiz_attempts.user_answers IS 'User provided answers';
COMMENT ON COLUMN quiz_attempts.time_taken IS 'Time taken to complete quiz in seconds';
COMMENT ON COLUMN quiz_attempts.created_at IS 'Quiz attempt timestamp';