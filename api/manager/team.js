// ---------------------------------------------------------------------
// FIȘIER: /api/manager/team.js
// Returnează lista de angajați cu status de compliance, pentru ecranul Echipă
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

export default async function handlerTeam(req, res) {
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

  const { data: employees, error: empErr } = await supabase
    .from('employees')
    .select('id, full_name, schedule_type')
    .eq('organization_id', orgId)
    .order('full_name', { ascending: true });

  if (empErr) return res.status(500).json({ error: empErr.message });

  // Pentru fiecare angajat: ultima tură + total ore luna curentă + are flag activ?
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const results = await Promise.all(
    employees.map(async (emp) => {
      const { data: lastShift } = await supabase
        .from('shifts')
        .select('start_time, end_time')
        .eq('employee_id', emp.id)
        .order('start_time', { ascending: false })
        .limit(1)
        .maybeSingle();

      const { data: monthShifts } = await supabase
        .from('shifts')
        .select('start_time, end_time')
        .eq('employee_id', emp.id)
        .gte('start_time', startOfMonth.toISOString());

      const totalHours = (monthShifts || []).reduce((sum, s) => {
        const h = (new Date(s.end_time) - new Date(s.start_time)) / (1000 * 60 * 60);
        return sum + h;
      }, 0);

      const { count: activeFlags } = await supabase
        .from('compliance_flags')
        .select('id', { count: 'exact', head: true })
        .eq('employee_id', emp.id)
        .eq('resolved', false);

      return {
        id: emp.id,
        full_name: emp.full_name,
        schedule_type: emp.schedule_type,
        last_shift: lastShift || null,
        hours_this_month: Math.round(totalHours * 10) / 10,
        status: (activeFlags || 0) > 0 ? 'risk' : 'ok',
      };
    })
  );

  return res.status(200).json({ employees: results });
}
