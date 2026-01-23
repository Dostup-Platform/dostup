-- Create notification_preferences table for customizable reminders
CREATE TABLE public.notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_phone TEXT NOT NULL UNIQUE,
  reminder_24h BOOLEAN NOT NULL DEFAULT true,
  reminder_morning BOOLEAN NOT NULL DEFAULT false,
  morning_time TIME NOT NULL DEFAULT '08:00',
  reminder_2h BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

-- Allow anyone to manage their notification preferences
CREATE POLICY "Anyone can view notification preferences"
ON public.notification_preferences
FOR SELECT
USING (true);

CREATE POLICY "Anyone can insert notification preferences"
ON public.notification_preferences
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Anyone can update notification preferences"
ON public.notification_preferences
FOR UPDATE
USING (true);

-- Create trigger for updated_at
CREATE TRIGGER update_notification_preferences_updated_at
BEFORE UPDATE ON public.notification_preferences
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for notification preferences
ALTER PUBLICATION supabase_realtime ADD TABLE public.notification_preferences;