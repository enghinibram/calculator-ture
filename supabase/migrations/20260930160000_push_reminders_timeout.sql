-- =====================================================================
-- CALCULATORTURE — Migrare: timeout mai mare pentru cron-ul de reminder
-- Apelul net.http_post din send-shift-reminders-hourly folosea timeout-ul
-- implicit pg_net de 5000 ms; la pornirea la rece a Edge Function-ului
-- sau la trimiteri către mai multe abonamente, răspunsul întârzia peste
-- limită (timed_out = true în net._http_response).
--
-- cron.schedule cu un nume existent actualizează job-ul (pg_cron >= 1.4).
-- Restul apelului e identic cu 20260903015736_push_reminders.sql.
-- =====================================================================

select cron.schedule(
  'send-shift-reminders-hourly',
  '0 * * * *',
  $$
  select net.http_post(
    url := 'https://gtgjwriutlyhvfoyucsq.supabase.co/functions/v1/send-shift-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        select decrypted_secret from vault.decrypted_secrets
        where name = 'PUSH_REMINDER_CRON_SECRET'
      )
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  ) as request_id;
  $$
);
