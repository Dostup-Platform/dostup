-- Fix push_tokens RLS - restrict direct access
DROP POLICY IF EXISTS "Allow all operations on push_tokens" ON public.push_tokens;

-- Only allow INSERT via direct access (for initial token save)
-- All other operations go through edge functions
CREATE POLICY "Allow insert push_tokens"
  ON public.push_tokens FOR INSERT
  WITH CHECK (true);

-- Deny direct SELECT (use edge function instead)
CREATE POLICY "No direct read push_tokens"
  ON public.push_tokens FOR SELECT
  USING (false);

-- Deny direct UPDATE (use edge function instead)
CREATE POLICY "No direct update push_tokens"
  ON public.push_tokens FOR UPDATE
  USING (false);

-- Deny direct DELETE (use edge function instead)
CREATE POLICY "No direct delete push_tokens"
  ON public.push_tokens FOR DELETE
  USING (false);

-- Create signup_tokens table for secure signup flow
CREATE TABLE IF NOT EXISTS public.signup_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  token TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  product_id UUID REFERENCES public.products(id),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on signup_tokens
ALTER TABLE public.signup_tokens ENABLE ROW LEVEL SECURITY;

-- Only allow operations via edge functions (service role)
CREATE POLICY "No direct access to signup_tokens"
  ON public.signup_tokens FOR ALL
  USING (false);

-- Make materials bucket private
UPDATE storage.buckets 
SET public = false 
WHERE id = 'materials';

-- Drop all existing permissive storage policies for materials
DROP POLICY IF EXISTS "Anyone can view materials files" ON storage.objects;
DROP POLICY IF EXISTS "Allow public uploads to materials" ON storage.objects;
DROP POLICY IF EXISTS "Allow public updates to materials" ON storage.objects;
DROP POLICY IF EXISTS "Allow public deletes to materials" ON storage.objects;
DROP POLICY IF EXISTS "Creators can upload materials" ON storage.objects;
DROP POLICY IF EXISTS "Creators can update their materials" ON storage.objects;
DROP POLICY IF EXISTS "Creators can delete their materials" ON storage.objects;

-- Create restrictive policies - operations go through edge functions with service role
-- Allow service role (edge functions) to manage materials
-- Block direct access from anon/authenticated users
CREATE POLICY "Block direct read materials"
  ON storage.objects FOR SELECT
  USING (bucket_id != 'materials');

CREATE POLICY "Block direct insert materials"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id != 'materials');

CREATE POLICY "Block direct update materials"
  ON storage.objects FOR UPDATE
  USING (bucket_id != 'materials');

CREATE POLICY "Block direct delete materials"
  ON storage.objects FOR DELETE
  USING (bucket_id != 'materials');