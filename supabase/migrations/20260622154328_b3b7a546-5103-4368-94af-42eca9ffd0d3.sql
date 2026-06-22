DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cleanup-deleted-materials') THEN
    PERFORM cron.unschedule('cleanup-deleted-materials');
  END IF;
END $$;

SELECT cron.schedule(
  'cleanup-deleted-materials',
  '0 3 * * *',
  $$DELETE FROM public.materials WHERE deleted_at IS NOT NULL AND deleted_at < now() - interval '30 days'$$
);