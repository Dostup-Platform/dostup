-- Drop ALL policies that might reference products.creator_id
DROP POLICY IF EXISTS "Creators can manage their own products" ON public.products;
DROP POLICY IF EXISTS "Users can view materials for purchased products" ON public.materials;
DROP POLICY IF EXISTS "Creators can manage materials for their products" ON public.materials;
DROP POLICY IF EXISTS "Creators can manage schedules for their products" ON public.schedules;
DROP POLICY IF EXISTS "Creators can manage time slots for their schedules" ON public.time_slots;
DROP POLICY IF EXISTS "Creators can view bookings for their schedules" ON public.bookings;
DROP POLICY IF EXISTS "Creators can view purchases for their products" ON public.purchases;

-- Now change creator_id from uuid to text
ALTER TABLE public.products 
  ALTER COLUMN creator_id TYPE text USING creator_id::text;

-- Recreate permissive policies
CREATE POLICY "Anyone can manage products" 
ON public.products FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Anyone can manage materials" 
ON public.materials FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Anyone can manage schedules" 
ON public.schedules FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Anyone can manage time slots" 
ON public.time_slots FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Anyone can view bookings" 
ON public.bookings FOR SELECT USING (true);

CREATE POLICY "Anyone can view purchases" 
ON public.purchases FOR SELECT USING (true);