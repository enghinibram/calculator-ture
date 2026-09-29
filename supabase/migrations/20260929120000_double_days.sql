-- =====================================================================
-- CALCULATORTURE — Migrare: Duble pe zi + plată pe tură
-- Adaugă în user_settings:
--   double_days       — JSON text { "YYYY-M-D": oreSuplimentare }, aceeași
--                       serializare text ca co_days / cm_days / custom_days.
--                       Zilele fără cheie = fără dublă (datele vechi rămân valide).
--   pay_per_shift     — plata unei ture normale (lei), implicit 200
--   double_multiplier — multiplicatorul dublei (2 = 200%), implicit 2
-- =====================================================================

alter table public.user_settings
  add column if not exists double_days       text,
  add column if not exists pay_per_shift     numeric default 200,
  add column if not exists double_multiplier numeric default 2;
