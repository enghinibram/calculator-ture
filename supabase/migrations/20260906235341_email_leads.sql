-- =====================================================================
-- CALCULATORTURE — Migrare: Capturare email (popup slide-in calculator)
-- Tabel simplu de leads: userul lasă emailul din popup-ul de pe pagina
-- calculatorului, fără reminder-e (SMTP nu e configurat încă) — doar
-- colectare, pentru re-atragere ulterioară.
-- =====================================================================

create table if not exists public.email_leads (
  id         uuid primary key default gen_random_uuid(),
  email      text not null,
  created_at timestamptz not null default now(),
  source     text not null default 'popup_calculator',
  constraint email_leads_email_key unique (email)
);

alter table public.email_leads enable row level security;

-- Frontendul (cheia publică, rol anon) trebuie să poată insera un lead
-- nou. Fără politică de SELECT pentru anon — RLS blochează implicit
-- orice citire; doar service_role (bypass RLS) poate citi lista.
create policy "email_leads_insert_anon"
  on public.email_leads
  for insert
  to anon
  with check (true);
