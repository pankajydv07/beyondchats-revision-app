-- Create storage bucket for PDF files
-- Run this in your Supabase SQL Editor

-- Create the pdfs storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('pdfs', 'pdfs', false)
ON CONFLICT (id) DO NOTHING;

-- Create storage policy for pdfs bucket - users can only access their own files
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