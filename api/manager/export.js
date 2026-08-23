// ---------------------------------------------------------------------
// FIȘIER: /api/manager/export.js
// Generează datele pentru evidența orelor (Art. 119) — returnează JSON
// structurat; PDF-ul propriu-zis se generează client-side (vezi notă).
// ---------------------------------------------------------------------
import { createClient } from '@supabase/supabase-js';

function getSupabaseForRequest(req) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  );
}

export default async function handlerExport(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const supabase = getSupabaseForRequest(req);
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return res.status(401).json({ error: 'Unauthorized' });

  const { data: managerAccount } = await supabase
    .from('manager_accounts')
    .select('organization_id')
    .eq('id', user.id)
    .single();

  if (!managerAccount) return res.status(403).json({ error: 'Cont de manager negăsit' });

  const orgId = managerAccount.organization_id;

  // Luna cerută, ex: /api/manager/export?month=2026-08
  const monthParam = req.query.month || new Date().toISOString().slice(0, 7);
  const [year, month] = monthParam.split('-').map(Number);
  const startDate = new Date(Date.UTC(year, month - 1, 1));
  const endDate = new Date(Date.UTC(year, month, 1));

  const { data: org } = await supabase
    .from('organizations')
    .select('name, cui')
    .eq('id', orgId)
    .single();

  const { data: employees } = await supabase
    .from('employees')
    .select('id, full_name')
    .eq('organization_id', orgId)
    .order('full_name', { ascending: true });

  const report = await Promise.all(
    (employees || []).map(async (emp) => {
      const { data: shifts } = await supabase
        .from('shifts')
        .select('start_time, end_time, is_night_shift')
        .eq('employee_id', emp.id)
        .gte('start_time', startDate.toISOString())
        .lt('start_time', endDate.toISOString())
        .order('start_time', { ascending: true });

      const totalHours = (shifts || []).reduce((sum, s) => {
        return sum + (new Date(s.end_time) - new Date(s.start_time)) / (1000 * 60 * 60);
      }, 0);

      const nightHours = (shifts || [])
        .filter(s => s.is_night_shift)
        .reduce((sum, s) => sum + (new Date(s.end_time) - new Date(s.start_time)) / (1000 * 60 * 60), 0);

      return {
        employee_name: emp.full_name,
        total_hours: Math.round(totalHours * 10) / 10,
        night_hours: Math.round(nightHours * 10) / 10,
        shift_count: (shifts || []).length,
        shifts: (shifts || []).map(s => ({
          start: s.start_time,
          end: s.end_time,
          is_night: s.is_night_shift,
        })),
      };
    })
  );

  return res.status(200).json({
    organization: org,
    period: monthParam,
    generated_at: new Date().toISOString(),
    legal_reference: 'Art. 119 din Codul Muncii — evidența orelor de muncă prestate zilnic',
    employees: report,
  });
}

// ---------------------------------------------------------------------
// NOTĂ despre generarea PDF-ului:
// Acest endpoint returnează datele structurate. Pentru PDF-ul propriu-zis,
// cea mai simplă cale în stack-ul tău (Vanilla JS + Vercel) e să folosești
// o librărie client-side precum jsPDF sau pdf-lib, care ia acest JSON
// și generează documentul direct în browser — eviți să complici backend-ul
// cu generare de PDF pe server (mai lent, mai multe dependențe).
// Pentru Excel (raportul sumar), poți folosi SheetJS (xlsx), tot client-side.
// ---------------------------------------------------------------------
