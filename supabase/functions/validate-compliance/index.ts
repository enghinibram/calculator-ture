// =====================================================================
// CALCULATORTURE — Edge Function: validate-compliance
// Rulează zilnic (Supabase Cron / Vercel Cron) și verifică turele
// tuturor angajaților față de regulile din schedule_types.
//
// Deploy: supabase functions deploy validate-compliance
// Schedule: supabase functions schedule (sau cron extern care apelează
// endpoint-ul, dacă preferi Vercel cron ca restul infra-structurii tale)
// =====================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

type Shift = {
  id: string;
  employee_id: string;
  start_time: string;
  end_time: string;
  is_night_shift: boolean;
};

type ScheduleRule = {
  code: string;
  min_rest_hours: number;
  max_weekly_hours: number;
  shift_length_hours: number;
};

type Employee = {
  id: string;
  organization_id: string;
  schedule_type: string;
};

// -----------------------------------------------------------------
// Funcție principală — rulează pentru toate organizațiile active
// -----------------------------------------------------------------
async function runComplianceCheck() {
  const { data: employees, error: empErr } = await supabase
    .from("employees")
    .select("id, organization_id, schedule_type");

  if (empErr) {
    console.error("Eroare la citirea angajaților:", empErr);
    return { success: false, error: empErr.message };
  }

  const { data: rules, error: rulesErr } = await supabase
    .from("schedule_types")
    .select("code, min_rest_hours, max_weekly_hours, shift_length_hours");

  if (rulesErr) {
    console.error("Eroare la citirea regulilor:", rulesErr);
    return { success: false, error: rulesErr.message };
  }

  const rulesByCode = new Map<string, ScheduleRule>(
    rules.map((r: ScheduleRule) => [r.code, r])
  );

  let totalFlags = 0;

  for (const employee of employees as Employee[]) {
    const rule = rulesByCode.get(employee.schedule_type);
    if (!rule) continue; // tip de program necunoscut — skip, dar ar trebui logat

    // Ia ultimele 30 de zile de ture pentru acest angajat
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: shifts, error: shiftsErr } = await supabase
      .from("shifts")
      .select("id, employee_id, start_time, end_time, is_night_shift")
      .eq("employee_id", employee.id)
      .gte("start_time", thirtyDaysAgo.toISOString())
      .order("start_time", { ascending: true });

    if (shiftsErr || !shifts || shifts.length === 0) continue;

    const flags = [
      ...checkInsufficientRest(shifts as Shift[], rule),
      ...checkWeeklyOvertime(shifts as Shift[], rule),
      ...checkConsecutiveShiftsNoRest(shifts as Shift[]),
    ];

    for (const flag of flags) {
      // Evită duplicate: verifică dacă exact aceeași alertă (tip + ture) există deja nerezolvată
      const { data: existing } = await supabase
        .from("compliance_flags")
        .select("id")
        .eq("employee_id", employee.id)
        .eq("flag_type", flag.flag_type)
        .contains("related_shift_ids", flag.related_shift_ids)
        .eq("resolved", false)
        .limit(1);

      if (existing && existing.length > 0) continue;

      await supabase.from("compliance_flags").insert({
        organization_id: employee.organization_id,
        employee_id: employee.id,
        flag_type: flag.flag_type,
        severity: flag.severity,
        law_reference: flag.law_reference,
        related_shift_ids: flag.related_shift_ids,
        details: flag.details,
      });
      totalFlags++;
    }
  }

  return { success: true, flags_created: totalFlags };
}

// -----------------------------------------------------------------
// Regula 1: repaus insuficient între două ture consecutive
// -----------------------------------------------------------------
function checkInsufficientRest(shifts: Shift[], rule: ScheduleRule) {
  const flags = [];
  for (let i = 1; i < shifts.length; i++) {
    const prev = shifts[i - 1];
    const curr = shifts[i];
    const restHours =
      (new Date(curr.start_time).getTime() - new Date(prev.end_time).getTime()) /
      (1000 * 60 * 60);

    if (restHours < rule.min_rest_hours) {
      flags.push({
        flag_type: "insufficient_rest",
        severity: "risk",
        law_reference: "Art. 137 CM",
        related_shift_ids: [prev.id, curr.id],
        details: {
          rest_hours_found: Math.round(restHours * 10) / 10,
          rest_hours_required: rule.min_rest_hours,
        },
      });
    }
  }
  return flags;
}

// -----------------------------------------------------------------
// Regula 2: depășire ore săptămânale față de maximul legal
// -----------------------------------------------------------------
function checkWeeklyOvertime(shifts: Shift[], rule: ScheduleRule) {
  const flags = [];
  const weekBuckets = new Map<string, Shift[]>();

  for (const shift of shifts) {
    const weekKey = getISOWeekKey(new Date(shift.start_time));
    if (!weekBuckets.has(weekKey)) weekBuckets.set(weekKey, []);
    weekBuckets.get(weekKey)!.push(shift);
  }

  for (const [weekKey, weekShifts] of weekBuckets) {
    const totalHours = weekShifts.reduce((sum, s) => {
      const h =
        (new Date(s.end_time).getTime() - new Date(s.start_time).getTime()) /
        (1000 * 60 * 60);
      return sum + h;
    }, 0);

    if (totalHours > rule.max_weekly_hours) {
      flags.push({
        flag_type: "weekly_overtime",
        severity: "risk",
        law_reference: "Art. 120 CM",
        related_shift_ids: weekShifts.map((s) => s.id),
        details: {
          week: weekKey,
          hours_worked: Math.round(totalHours * 10) / 10,
          hours_allowed: rule.max_weekly_hours,
        },
      });
    }
  }
  return flags;
}

// -----------------------------------------------------------------
// Regula 3: prea multe ture consecutive fără o zi de repaus săptămânal
// (simplificat: 6+ ture fără o pauză de minim 24h consecutive în 7 zile)
// -----------------------------------------------------------------
function checkConsecutiveShiftsNoRest(shifts: Shift[]) {
  const flags = [];
  let consecutiveCount = 1;

  for (let i = 1; i < shifts.length; i++) {
    const prev = shifts[i - 1];
    const curr = shifts[i];
    const gapHours =
      (new Date(curr.start_time).getTime() - new Date(prev.end_time).getTime()) /
      (1000 * 60 * 60);

    if (gapHours < 24) {
      consecutiveCount++;
    } else {
      consecutiveCount = 1;
    }

    if (consecutiveCount === 6) {
      // marchează o singură dată la atingerea pragului, nu repetat
      const involvedShifts = shifts.slice(i - 5, i + 1);
      flags.push({
        flag_type: "missing_weekly_rest",
        severity: "warning",
        law_reference: "Art. 137 CM",
        related_shift_ids: involvedShifts.map((s) => s.id),
        details: { consecutive_shifts: consecutiveCount },
      });
    }
  }
  return flags;
}

// -----------------------------------------------------------------
// Utilitar: cheie săptămână ISO (an-săptămână), pentru grupare
// -----------------------------------------------------------------
function getISOWeekKey(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${weekNo}`;
}

// -----------------------------------------------------------------
// Handler HTTP (apelat de cron)
// -----------------------------------------------------------------
Deno.serve(async (req) => {
  // Protejează endpoint-ul cu un secret, ca să nu poată fi apelat de oricine
  const authHeader = req.headers.get("Authorization");
  const cronSecret = Deno.env.get("CRON_SECRET");
  if (authHeader !== `Bearer ${cronSecret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const result = await runComplianceCheck();
  return new Response(JSON.stringify(result), {
    headers: { "Content-Type": "application/json" },
    status: result.success ? 200 : 500,
  });
});
