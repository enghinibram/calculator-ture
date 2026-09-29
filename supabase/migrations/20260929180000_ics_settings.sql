-- =====================================================================
-- CALCULATORTURE — Migrare: Setări export calendar (.ics)
-- O singură coloană JSON text (ca double_days), ca setările viitoare de
-- export să nu mai ceară migrări:
--   dayStart / nightStart — ora de start a turei de zi / noapte
--   alarmDay / alarmNight — ora alarmei în ziua turei
--   alarm2 / alarm2Min    — alarmă secundară, minute înainte de prima
--   includeLeave          — CO/CM ca evenimente pe toată ziua, fără alarmă
-- =====================================================================

alter table public.user_settings
  add column if not exists ics_settings text
  default '{"dayStart":"07:00","nightStart":"19:00","alarmDay":"05:30","alarmNight":"17:30","alarm2":false,"alarm2Min":30,"includeLeave":false}';
