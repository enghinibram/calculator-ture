-- =====================================================================
-- CALCULATORTURE — Migrare: Push notifications (reminder înainte de tură)
-- Adaugă: ora de start a turei per user, constraint anti-duplicate pe
-- push_subscriptions, tabel de audit pentru trimiteri (dedupe reminder-e),
-- extensiile pg_cron/pg_net, și cron job-ul orar care apelează Edge
-- Function-ul send-shift-reminders.
-- =====================================================================

-- Ora de start a turei (aplicată tuturor zilelor de lucru din pattern-ul
-- userului). Fără ea, reminder-ul "X ore înainte" nu poate fi calculat —
-- userii care nu o completează nu primesc notificări.
alter table public.user_settings
  add column if not exists shift_start_time time;

-- Evită rânduri duplicate în push_subscriptions la activări repetate ale
-- notificărilor pentru același user + device (folosit de upsert-ul din
-- app.js, onConflict: 'user_id,endpoint').
alter table public.push_subscriptions
  add constraint push_subscriptions_user_endpoint_key unique (user_id, endpoint);

-- Audit / dedupe: cel mult un reminder trimis per user per zi de tură,
-- indiferent de câte ori "vede" cron-ul orar aceeași tură în fereastra
-- de 2-3h înainte de start.
create table if not exists public.push_reminder_log (
  user_id    uuid not null references auth.users(id) on delete cascade,
  shift_date date not null,
  sent_at    timestamptz not null default now(),
  primary key (user_id, shift_date)
);
alter table public.push_reminder_log enable row level security;
-- Fără policy-uri — doar service_role (folosit de Edge Function) poate
-- citi/scrie; RLS blochează implicit orice acces din client.

-- Extensii necesare pentru cron nativ Postgres.
create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

-- Job orar: apelează send-shift-reminders cu secretul din Vault
-- (PUSH_REMINDER_CRON_SECRET — valoarea reală se adaugă separat în Vault,
-- NU e stocată în acest fișier).
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
    body := '{}'::jsonb
  ) as request_id;
  $$
);
