
-- Table for one-time material access tokens
CREATE TABLE public.material_access_tokens (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  token text NOT NULL UNIQUE,
  file_path text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  expires_at timestamp with time zone NOT NULL,
  used boolean NOT NULL DEFAULT false
);

-- Enable RLS
ALTER TABLE public.material_access_tokens ENABLE ROW LEVEL SECURITY;

-- Only service role can access (edge functions use service role key)
CREATE POLICY "No direct access to material_access_tokens"
  ON public.material_access_tokens
  FOR ALL
  USING (false);

-- Index for fast token lookup
CREATE INDEX idx_material_access_tokens_token ON public.material_access_tokens (token);

-- Auto-cleanup old tokens (optional: can be cleaned by cron later)
CREATE INDEX idx_material_access_tokens_expires ON public.material_access_tokens (expires_at);
