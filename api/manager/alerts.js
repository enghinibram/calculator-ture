// ---------------------------------------------------------------------
// FIȘIER: /api/manager/alerts.js
// Returnează alertele active de compliance, pentru ecranul Alerte legale
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

export default async function handlerAlerts(req, res) {
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

  // ---- GET: listă alerte active ----
  if (req.method === 'GET') {
    const { data: flags, error } = await supabase
      .from('compliance_flags')
      .select(`
        id, flag_type, severity, law_reference, details, detected_at,
        employees ( full_name )
      `)
      .eq('organization_id', orgId)
      .eq('resolved', false)
      .order('detected_at', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });

    const formatted = flags.map(f => ({
      id: f.id,
      employee_name: f.employees?.full_name || 'Necunoscut',
      flag_type: f.flag_type,
      title: buildAlertTitle(f.flag_type, f.employees?.full_name, f.details),
      severity: f.severity,
      law_reference: f.law_reference,
      details: f.details,
      detected_at: f.detected_at,
    }));

    return res.status(200).json({ alerts: formatted });
  }

  // ---- PATCH: marchează o alertă ca rezolvată ----
  if (req.method === 'PATCH') {
    const { flag_id } = req.body;
    if (!flag_id) return res.status(400).json({ error: 'flag_id lipsă' });

    const { error } = await supabase
      .from('compliance_flags')
      .update({ resolved: true, resolved_at: new Date().toISOString() })
      .eq('id', flag_id)
      .eq('organization_id', orgId); // asigurare suplimentară dincolo de RLS

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

function buildAlertTitle(flagType, employeeName, details) {
  switch (flagType) {
    case 'insufficient_rest':
      return `${employeeName} — repaus sub ${details?.rest_hours_required}h între ture`;
    case 'weekly_overtime':
      return `${employeeName} — depășire ore suplimentare săptămânale`;
    case 'missing_weekly_rest':
      return `${employeeName} — ${details?.consecutive_shifts} ture consecutive fără zi liberă`;
    default:
      return `${employeeName} — neconformitate detectată`;
  }
}
