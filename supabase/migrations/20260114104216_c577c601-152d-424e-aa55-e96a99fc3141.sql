-- Create table for storing FCM push tokens
CREATE TABLE public.push_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_phone TEXT NOT NULL,
  user_role TEXT NOT NULL DEFAULT 'student',
  fcm_token TEXT NOT NULL,
  device_info TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_phone, fcm_token)
);

-- Enable Row Level Security
ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;

-- Allow all operations on push_tokens (needed for saving tokens from any user)
CREATE POLICY "Allow all operations on push_tokens"
ON public.push_tokens
FOR ALL
USING (true)
WITH CHECK (true);

-- Create indexes for faster lookups
CREATE INDEX idx_push_tokens_user_phone ON public.push_tokens(user_phone);
CREATE INDEX idx_push_tokens_fcm_token ON public.push_tokens(fcm_token);

-- Add trigger for updating updated_at
CREATE TRIGGER update_push_tokens_updated_at
BEFORE UPDATE ON public.push_tokens
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();