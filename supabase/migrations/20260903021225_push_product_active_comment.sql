-- Documentează la nivel de schemă natura temporară a legăturii
-- is_premium <-> push_product_active (vezi și comentariile din
-- api/lemonsqueezy-webhook.js și supabase/functions/send-shift-reminders).
comment on column public.premium_status.push_product_active is
  'TEMPORAR sincronizat cu is_premium (push e azi doar un beneficiu inclus '
  'în Premium, fără flow propriu de vânzare). Planul e ca push să devină '
  'vandabil separat, standalone, și la useri non-Premium — la acel moment, '
  'nu mai seta automat această coloană din webhook-ul de premium, ci '
  'printr-un toggle/flow de plată dedicat.';
