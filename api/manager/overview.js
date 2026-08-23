// =====================================================================
// CALCULATORTURE — API routes pentru /manager
// Structură: /api/manager/*.js (Vercel Serverless Functions)
// Toate rutele verifică sesiunea managerului prin Supabase Auth
// și se bazează pe RLS pentru izolarea datelor între organizații.
// =====================================================================

// ---------------------------------------------------------------------
// FIȘIER: /api/manager/overview.js
// Returnează KPI-urile pentru ecranul principal (Overview)
// ---------------------------------------------------------------------
import { createClient } from '@supabase/supabase-js';

function getSupabaseForRequest(req) {
  // Folosește token-ul userului din header, ca RLS să se aplice corect
  const token = req.headers.authorization?.replace('Bearer ', '');
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  );
}

export default async function handlerOverview(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const supabase = getSupabaseForRequest(req);

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return res.status(401).json({ error: 'Unauthorized' });

  // Organizația managerului (RLS se ocupă de filtrare, dar luăm explicit id-ul)
  const { data: managerAccount, error: maErr } = await supabase
    .from('manager_accounts')
    .select('organization_id, full_name')
    .eq('id', user.id)
    .single();

  if (maErr || !managerAccount) {
    return res.status(403).json({ error: 'Cont de manager negăsit' });
  }

  const orgId = managerAccount.organization_id;

  // Zile cu risc din ultimele 30 de zile (flags nerezolvate, severity = risk)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data: riskFlags } = await supabase
    .from('compliance_flags')
    .select('id, employee_id, flag_type, detected_at')
    .eq('organization_id', orgId)
    .eq('severity', 'risk')
    .eq('resolved', false)
    .gte('detected_at', thirtyDaysAgo.toISOString());

  const { data: overtimeFlags } = await supabase
    .from('compliance_flags')
    .select('id, employee_id, details')
    .eq('organization_id', orgId)
    .eq('flag_type', 'weekly_overtime')
    .eq('resolved', false);

  const { count: totalEmployees } = await supabase
    .from('employees')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', orgId);

  const employeesWithFlags = new Set(
    [...(riskFlags || []), ...(overtimeFlags || [])].map(f => f.employee_id)
  );

  const totalOvertimeHours = (overtimeFlags || []).reduce(
    (sum, f) => sum + (f.details?.hours_worked - f.details?.hours_allowed || 0), 0
  );

  return res.status(200).json({
    manager_name: managerAccount.full_name,
    risk_days_30d: riskFlags?.length || 0,
    overtime_hours: Math.round(totalOvertimeHours * 10) / 10,
    employees_with_flags: employeesWithFlags.size,
    total_employees: totalEmployees || 0,
    compliant_employees: (totalEmployees || 0) - employeesWithFlags.size,
  });
}
