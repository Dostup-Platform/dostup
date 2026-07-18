-- Allow product owners to update their purchases (e.g. reject). 'completed' status is still protected by prevent_purchase_fraud trigger for non-service_role.
DROP POLICY IF EXISTS "Owners can update product purchases" ON public.purchases;
CREATE POLICY "Owners can update product purchases" ON public.purchases
FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.products p WHERE p.id = purchases.product_id AND p.owner_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.products p WHERE p.id = purchases.product_id AND p.owner_id = auth.uid()));