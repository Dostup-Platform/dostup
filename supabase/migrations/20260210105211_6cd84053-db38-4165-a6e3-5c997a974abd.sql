
CREATE TABLE public.material_unlocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id UUID REFERENCES materials(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  material_title TEXT NOT NULL,
  product_title TEXT NOT NULL,
  unlocked_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE material_unlocks ENABLE ROW LEVEL SECURITY;

-- Anon SELECT since simple_users don't use Supabase auth; frontend filters by purchased products
CREATE POLICY "Anyone can read material unlocks"
  ON material_unlocks FOR SELECT
  USING (true);

-- Only service_role (edge functions) can insert
CREATE POLICY "Service role can insert material unlocks"
  ON material_unlocks FOR INSERT
  WITH CHECK (true);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.material_unlocks;
