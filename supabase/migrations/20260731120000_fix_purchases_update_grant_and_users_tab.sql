-- RLS policy for owner UPDATE on purchases already exists (20260718103545),
-- but the matching GRANT was missing, so PostgREST returned permission denied
-- for reject/revoke actions from the frontend.
GRANT UPDATE ON public.purchases TO authenticated;
