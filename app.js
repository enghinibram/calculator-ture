// ===== Supabase Init =====
const { createClient } = supabase;
const sb = createClient(
  'https://gtgjwriutlyhvfoyucsq.supabase.co',
  'sb_publishable_X_FP_x4U_Fj54ImuOFXOGQ_V2x6iKOv'
);

// ===== State =====
const today = new Date();
let viewYear  = today.getFullYear();
let viewMonth = today.getMonth();
let startDate = null;
let filters   = { ort: true, iud: true, isl: true };
let currentUser = null;

let coDays = new Set();
let cmDays = new Set();
let editMode = null;

// Duble: { 'YYYY-M-D': oreSuplimentare } — prezența cheii = zi cu dublă.
// Dubla NU e a doua tură: ziua se numără o dată, plătită cu payPerShift × doubleMultiplier.
let doubleDays = {};
const DOUBLE_ORE_DEFAULT = 12;
let payPerShift = null;     // lei / tură normală; null = necompletat (fără sumă afișată)
let doubleMultiplier = 2;   // 2 = 200%
const DUBLE_LOCAL_KEY = 'ture-duble'; // salvare locală pentru utilizatorii fără cont

// Setări export calendar (.ics) — salvate ca setările de plată (coloana ics_settings, JSON)
const ICS_DEFAULTS = {
  dayStart: '07:00', nightStart: '19:00',   // ora de start a turei de zi / noapte
  alarmDay: '05:30', alarmNight: '17:30',   // ora alarmei în ziua turei
  alarm2: false, alarm2Min: 30,             // alarmă secundară, minute înainte de prima
  includeLeave: false,                      // CO/CM ca evenimente pe toată ziua, fără alarmă
};
let icsSettings = { ...ICS_DEFAULTS };
let calculFacutTrimis = false; // GA4: trimitem calcul_facut o singură dată per sesiune
let pushEligible = false; // is_premium && push_product_active — gatează UI-ul de notificări

// ===== Dark Mode =====
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  document.getElementById('theme-toggle').textContent = theme === 'dark' ? '☀️' : '🌙';
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  localStorage.setItem('ture-theme', next);
}

(function initTheme() {
  const saved = localStorage.getItem('ture-theme') || 'light';
  applyTheme(saved);
})();

// ===== Norme oficiale ore/lună =====
const NORMA = {
  2025: [168, 160, 168, 168, 160, 168, 184, 168, 176, 184, 160, 160],
  2026: [144, 160, 176, 160, 160, 168, 184, 168, 176, 176, 160, 168],
};

function getNorma(year, month) {
  if (NORMA[year]) return NORMA[year][month];
  let wd = 0;
  const days = new Date(year, month + 1, 0).getDate();
  for (let d = 1; d <= days; d++) {
    const dow = new Date(year, month, d).getDay();
    if (dow !== 0 && dow !== 6) wd++;
  }
  return wd * 8;
}

// ===== Tipare de tură =====
const PATTERNS = {
  '12/24-12/48': {
    ore: 12,
    zile: [
      { type: 'zi',     label: 'Z' },
      { type: 'noapte', label: 'N' },
      { type: 'liber',  label: '' },
      { type: 'liber',  label: '' },
    ]
  },
  '12/24': {
    ore: 12,
    zile: [
      { type: 'zi',     label: 'Z' },
      { type: 'liber',  label: '' },
      { type: 'noapte', label: 'N' },
      { type: 'liber',  label: '' },
    ]
  },
  '12/24-24/72': {
    ore: 12,
    zile: [
      { type: 'zi',     label: 'Z' },
      { type: 'noapte', label: 'N' },
      { type: 'liber',  label: '' },
      { type: 'liber',  label: '' },
      { type: 'liber',  label: '' },
      { type: 'liber',  label: '' },
    ]
  },
  '8/3-dimineata': {
    ore: 8,
    zile: [
      { type: 'zi',    label: 'D' },
      { type: 'zi',    label: 'D' },
      { type: 'zi',    label: 'D' },
      { type: 'zi',    label: 'D' },
      { type: 'zi',    label: 'D' },
      { type: 'liber', label: '' },
      { type: 'liber', label: '' },
    ]
  },
  '8/3-dupaamiaza': {
    ore: 8,
    zile: [
      { type: 'noapte', label: 'A' },
      { type: 'noapte', label: 'A' },
      { type: 'noapte', label: 'A' },
      { type: 'noapte', label: 'A' },
      { type: 'noapte', label: 'A' },
      { type: 'liber',  label: '' },
      { type: 'liber',  label: '' },
    ]
  },
  '8/3-noapte': {
    ore: 8,
    zile: [
      { type: 'noapte', label: 'N' },
      { type: 'noapte', label: 'N' },
      { type: 'noapte', label: 'N' },
      { type: 'noapte', label: 'N' },
      { type: 'noapte', label: 'N' },
      { type: 'liber',  label: '' },
      { type: 'liber',  label: '' },
    ]
  },
  '8/3-rotativ': {
    ore: 8,
    zile: [
      { type: 'zi',     label: 'D' },
      { type: 'zi',     label: 'D' },
      { type: 'zi',     label: 'D' },
      { type: 'zi',     label: 'D' },
      { type: 'zi',     label: 'D' },
      { type: 'noapte', label: 'A' },
      { type: 'noapte', label: 'A' },
      { type: 'noapte', label: 'A' },
      { type: 'noapte', label: 'A' },
      { type: 'noapte', label: 'A' },
      { type: 'noapte', label: 'N' },
      { type: 'noapte', label: 'N' },
      { type: 'noapte', label: 'N' },
      { type: 'noapte', label: 'N' },
      { type: 'noapte', label: 'N' },
      { type: 'liber',  label: '' },
      { type: 'liber',  label: '' },
      { type: 'liber',  label: '' },
      { type: 'liber',  label: '' },
      { type: 'liber',  label: '' },
      { type: 'liber',  label: '' },
    ]
  },
  '24/48': {
    ore: 24,
    zile: [
      { type: 'zi',    label: '24' },
      { type: 'liber', label: '' },
      { type: 'liber', label: '' },
    ]
  },
  '24/72': {
    ore: 24,
    zile: [
      { type: 'zi',    label: '24' },
      { type: 'liber', label: '' },
      { type: 'liber', label: '' },
      { type: 'liber', label: '' },
    ]
  },
};

// ===== TURĂ CUSTOM =====
// customDays: Set de keys (YYYY-M-D) marcate ca lucrătoare
let customDays = new Set();
let customOrePerZi = 12; // default

function isCustomMode() {
  return document.getElementById('tura-type').value === 'custom';
}

function getCustomOre() {
  return parseInt(document.getElementById('custom-ore-input')?.value) || 12;
}

function buildCustomPattern() {
  // Returnează un pseudo-pattern compatibil cu restul logicii
  // Nu e folosit direct — getShift e overridden pentru custom
  return { ore: getCustomOre(), zile: [] };
}

// ===== Zile libere legale România 2026 =====
const LEGAL_HOLIDAYS = {
  '2026-1-1':  'Anul Nou',
  '2026-1-2':  'Anul Nou',
  '2026-1-24': 'Unirea Principatelor',
  '2026-4-10': 'Vinerea Mare',
  '2026-4-12': 'Paștele',
  '2026-4-13': 'Paștele',
  '2026-5-1':  'Ziua Muncii',
  '2026-6-1':  'Ziua Copilului',
  '2026-6-7':  'Rusaliile',
  '2026-6-8':  'Rusaliile',
  '2026-8-15': 'Sf. Maria',
  '2026-11-30':'Sf. Andrei',
  '2026-12-1': 'Ziua Națională',
  '2026-12-25':'Crăciunul',
  '2026-12-26':'Crăciunul',
};

// ===== Sărbători religioase/culturale 2026 =====
const HOLIDAYS = {
  '2026-1-6':  { name: 'Boboteaza',       type: 'ort' },
  '2026-1-7':  { name: 'Sf. Ioan',        type: 'ort' },
  '2026-2-24': { name: 'Dragobete',       type: 'ort' },
  '2026-3-8':  { name: '8 Martie',        type: 'ort' },
  '2026-4-5':  { name: 'Floriile',        type: 'ort' },
  '2026-4-11': { name: 'Sâmbăta Mare',    type: 'ort' },
  '2026-5-21': { name: 'Înălțarea',       type: 'ort' },
  '2026-2-2':  { name: 'Tu Bishvat',      type: 'iud' },
  '2026-3-2':  { name: 'Postul Esterei',  type: 'iud' },
  '2026-3-3':  { name: 'Purim',           type: 'iud' },
  '2026-4-1':  { name: 'Pesach',          type: 'iud' },
  '2026-4-2':  { name: 'Pesach',          type: 'iud' },
  '2026-4-3':  { name: 'Pesach',          type: 'iud' },
  '2026-4-4':  { name: 'Pesach',          type: 'iud' },
  '2026-4-7':  { name: 'Pesach',          type: 'iud' },
  '2026-4-8':  { name: 'Pesach',          type: 'iud' },
  '2026-5-22': { name: 'Shavuot',         type: 'iud' },
  '2026-7-29': { name: "Tisha B'Av",      type: 'iud' },
  '2026-9-11': { name: 'Rosh Hashana',    type: 'iud' },
  '2026-9-12': { name: 'Rosh Hashana',    type: 'iud' },
  '2026-9-20': { name: 'Yom Kippur',      type: 'iud' },
  '2026-9-25': { name: 'Sukkot',          type: 'iud' },
  '2026-10-1': { name: 'Simhat Torah',    type: 'iud' },
  '2026-12-15':{ name: 'Chanukah',        type: 'iud' },
  '2026-12-16':{ name: 'Chanukah',        type: 'iud' },
  '2026-12-17':{ name: 'Chanukah',        type: 'iud' },
  '2026-12-18':{ name: 'Chanukah',        type: 'iud' },
  '2026-12-19':{ name: 'Chanukah',        type: 'iud' },
  '2026-12-20':{ name: 'Chanukah',        type: 'iud' },
  '2026-12-21':{ name: 'Chanukah',        type: 'iud' },
  '2026-12-22':{ name: 'Chanukah',        type: 'iud' },
  '2026-3-19': { name: 'Eid al-Fitr',     type: 'isl' },
  '2026-3-20': { name: 'Eid al-Fitr',     type: 'isl' },
  '2026-5-26': { name: 'Ziua Arafah',     type: 'isl' },
  '2026-5-27': { name: 'Eid al-Adha',     type: 'isl' },
  '2026-5-28': { name: 'Eid al-Adha',     type: 'isl' },
  '2026-6-16': { name: 'An Nou Islamic',  type: 'isl' },
  '2026-6-25': { name: 'Ashura',          type: 'isl' },
  '2026-8-25': { name: 'Mawlid al-Nabi',  type: 'isl' },
};

// ===== Utilitare =====
function dayKey(y, m, d) { return y + '-' + m + '-' + d; }

function dayDiff(a, b) {
  const ua = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const ub = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((ub - ua) / 86400000);
}

function getPattern() {
  const val = document.getElementById('tura-type').value;
  if (val === 'custom') return null;
  return PATTERNS[val];
}

function getShift(dateObj) {
  if (isCustomMode()) {
    const key = dayKey(dateObj.getFullYear(), dateObj.getMonth() + 1, dateObj.getDate());
    if (customDays.has(key)) return { type: 'zi', label: 'Z' };
    return { type: 'liber', label: '' };
  }
  if (!startDate) return null;
  const pat  = getPattern();
  const diff = dayDiff(startDate, dateObj);
  const idx  = ((diff % pat.zile.length) + pat.zile.length) % pat.zile.length;
  return pat.zile[idx];
}

function getOrePerZi() {
  if (isCustomMode()) return getCustomOre();
  return getPattern().ore;
}

function getLegalHoliday(year, month, day) {
  return LEGAL_HOLIDAYS[dayKey(year, month, day)] || null;
}

function getHoliday(year, month, day) {
  const h = HOLIDAYS[dayKey(year, month, day)];
  if (!h || !filters[h.type]) return null;
  return h;
}

// ===== Serializare CO/CM =====
function serializeSet(s) { return JSON.stringify([...s]); }
function deserializeSet(str) {
  try { return new Set(JSON.parse(str)); }
  catch { return new Set(); }
}

// ===== Serializare duble =====
function deserializeObj(str) {
  try {
    const o = JSON.parse(str);
    return (o && typeof o === 'object' && !Array.isArray(o)) ? o : {};
  } catch { return {}; }
}

function applyDubleSettings(pay, mult) {
  const p = parseFloat(pay);
  const m = parseFloat(mult);
  if (p >= 0) payPerShift = p;
  if (m > 0)  doubleMultiplier = m;
  const payInp  = document.getElementById('pay-per-shift');
  const multInp = document.getElementById('double-multiplier');
  if (payInp)  payInp.value  = payPerShift ?? '';
  if (multInp) multInp.value = doubleMultiplier;
}

// ===== Copie locală a stării (ture-state), legată de cont =====
// Cheia e 'ture-state:anon' sau 'ture-state:<user id>', ca alt cont de pe același
// telefon să nu vadă datele altcuiva. Conținutul are același format ca rândul
// din user_settings, deci se aplică cu aceeași funcție ca datele din Supabase.
const LOCAL_STATE_PREFIX = 'ture-state:';
let stateOwner = 'anon';

function buildSettingsRow() {
  const startStr = startDate
    ? `${startDate.getFullYear()}-${String(startDate.getMonth()+1).padStart(2,'0')}-${String(startDate.getDate()).padStart(2,'0')}`
    : null;
  const shiftStartInput = document.getElementById('shift-start-time');
  return {
    start_date:        startStr,
    tura_type:         document.getElementById('tura-type').value,
    co_days:           serializeSet(coDays),
    cm_days:           serializeSet(cmDays),
    custom_days:       serializeSet(customDays),
    custom_ore:        getCustomOre(),
    shift_start_time:  shiftStartInput && shiftStartInput.value ? shiftStartInput.value : null,
    double_days:       JSON.stringify(doubleDays),
    pay_per_shift:     payPerShift,
    double_multiplier: doubleMultiplier,
    ics_settings:      JSON.stringify(icsSettings),
  };
}

function saveLocalState() {
  try { localStorage.setItem(LOCAL_STATE_PREFIX + stateOwner, JSON.stringify(buildSettingsRow())); }
  catch { /* storage indisponibil */ }
}

function readLocalState(owner) {
  try {
    const raw = localStorage.getItem(LOCAL_STATE_PREFIX + owner);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function removeLocalState(owner) {
  try { localStorage.removeItem(LOCAL_STATE_PREFIX + owner); } catch { /* ignorăm */ }
}

// Starea goală (ca la prima deschidere)
function resetState() {
  startDate = null;
  coDays = new Set(); cmDays = new Set(); customDays = new Set();
  doubleDays = {};
  payPerShift = null;
  doubleMultiplier = 2;
  icsSettings = { ...ICS_DEFAULTS };
  const sel = document.getElementById('tura-type');
  sel.value = sel.options[0].value;
  const oreInp = document.getElementById('custom-ore-input');
  if (oreInp) oreInp.value = 12;
  const shiftInp = document.getElementById('shift-start-time');
  if (shiftInp) shiftInp.value = '';
  applyDubleSettings(null, doubleMultiplier);
  applyIcsSettings(null);
  editMode = null;
  updateEditModeUI();
  updateTuraTypeUI();
}

function restoreLocalState(owner) {
  const row = readLocalState(owner);
  if (row) { applySettingsRow(row); return true; }
  if (owner === 'anon') loadDubleLocal(); // compatibilitate: cheia veche ture-duble
  return false;
}

// Schimbă contul căruia îi aparține starea afișată
function switchStateOwner(owner) {
  if (owner === stateOwner) return;
  const prev = stateOwner;
  // Prima logare pe acest telefon: păstrăm ce s-a introdus fără cont (ca înainte)
  const carryAnon = prev === 'anon' && !readLocalState(owner);
  if (!carryAnon) {
    resetState();
    restoreLocalState(owner);
  }
  // La ieșirea din cont, copia contului nu rămâne pe telefon
  if (prev !== 'anon' && owner === 'anon') removeLocalState(prev);
  stateOwner = owner;
}

// Contul din sesiunea salvată local (citit sincron, înainte de primul desen)
function getStoredSessionUserId() {
  try {
    const raw = localStorage.getItem(sb.auth.storageKey);
    const s = raw && JSON.parse(raw);
    return (s && (s.user?.id || s.currentSession?.user?.id)) || null;
  } catch { return null; }
}

// ===== Luna afișată (păstrată 24h de la ultima deschidere) =====
const VIEW_KEY = 'ture-view';
const VIEW_TTL_MS = 24 * 60 * 60 * 1000;

function saveViewMonth() {
  try { localStorage.setItem(VIEW_KEY, JSON.stringify({ y: viewYear, m: viewMonth, ts: Date.now() })); }
  catch { /* ignorăm */ }
}

function restoreViewMonth() {
  try {
    const v = JSON.parse(localStorage.getItem(VIEW_KEY));
    if (v && Date.now() - v.ts < VIEW_TTL_MS && Number.isInteger(v.y) && v.m >= 0 && v.m <= 11) {
      viewYear = v.y; viewMonth = v.m;
    }
  } catch { /* ignorăm */ }
  saveViewMonth(); // marchează deschiderea de acum
}

function loadDubleLocal() {
  try {
    const raw = localStorage.getItem(DUBLE_LOCAL_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    if (data.double_days && typeof data.double_days === 'object') doubleDays = data.double_days;
    applyDubleSettings(data.pay_per_shift, data.double_multiplier);
    applyIcsSettings(data.ics_settings);
  } catch { /* date corupte — ignorăm */ }
}

// ===== Setări .ics =====
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function applyIcsSettings(obj) {
  if (obj && typeof obj === 'object') {
    for (const k of ['dayStart', 'nightStart', 'alarmDay', 'alarmNight']) {
      if (TIME_RE.test(obj[k])) icsSettings[k] = obj[k];
    }
    if (typeof obj.alarm2 === 'boolean')       icsSettings.alarm2 = obj.alarm2;
    if (typeof obj.includeLeave === 'boolean') icsSettings.includeLeave = obj.includeLeave;
    const min = parseInt(obj.alarm2Min, 10);
    if (min > 0 && min <= 1440) icsSettings.alarm2Min = min;
  }
  const set = (id, prop, v) => { const el = document.getElementById(id); if (el) el[prop] = v; };
  set('ics-day-start',     'value',   icsSettings.dayStart);
  set('ics-night-start',   'value',   icsSettings.nightStart);
  set('ics-alarm-day',     'value',   icsSettings.alarmDay);
  set('ics-alarm-night',   'value',   icsSettings.alarmNight);
  set('ics-alarm2',        'checked', icsSettings.alarm2);
  set('ics-alarm2-min',    'value',   icsSettings.alarm2Min);
  set('ics-include-leave', 'checked', icsSettings.includeLeave);
  const row = document.getElementById('ics-alarm2-row');
  if (row) row.style.display = icsSettings.alarm2 ? 'flex' : 'none';
}

function readIcsInputs() {
  applyIcsSettings({
    dayStart:     document.getElementById('ics-day-start').value,
    nightStart:   document.getElementById('ics-night-start').value,
    alarmDay:     document.getElementById('ics-alarm-day').value,
    alarmNight:   document.getElementById('ics-alarm-night').value,
    alarm2:       document.getElementById('ics-alarm2').checked,
    alarm2Min:    document.getElementById('ics-alarm2-min').value,
    includeLeave: document.getElementById('ics-include-leave').checked,
  });
}

// Upsert separat: dacă migrarea ics_settings nu e rulată, nu blochează restul salvării
async function saveIcsRemote() {
  const { error } = await sb.from('user_settings').upsert({
    user_id:      currentUser.id,
    ics_settings: JSON.stringify(icsSettings),
  }, { onConflict: 'user_id' });
  if (error) console.error('Eroare salvare setări calendar:', error);
}

// Upsert separat: dacă migrarea cu coloanele noi nu e rulată încă,
// eroarea nu blochează salvarea turelor/CO/CM din saveSettings().
async function saveDubleRemote() {
  const { error } = await sb.from('user_settings').upsert({
    user_id:           currentUser.id,
    double_days:       JSON.stringify(doubleDays),
    pay_per_shift:     payPerShift,
    double_multiplier: doubleMultiplier,
  }, { onConflict: 'user_id' });
  if (error) console.error('Eroare salvare duble:', error);
}

// ===== Supabase: salvare =====
async function saveSettings() {
  saveLocalState();
  if (!currentUser) return;
  const row = buildSettingsRow();
  await sb.from('user_settings').upsert({
    user_id:          currentUser.id,
    start_date:       row.start_date,
    tura_type:        row.tura_type,
    co_days:          row.co_days,
    cm_days:          row.cm_days,
    custom_days:      row.custom_days,
    custom_ore:       row.custom_ore,
    shift_start_time: row.shift_start_time,
  }, { onConflict: 'user_id' });
  await saveDubleRemote();
  await saveIcsRemote();
}

// ===== Supabase: încărcare =====
// Aplică un rând de setări (din Supabase sau din copia locală); câmpurile goale
// păstrează valoarea curentă.
function applySettingsRow(data) {
  if (!data) return;
  if (data.tura_type) {
    document.getElementById('tura-type').value = data.tura_type;
    updateTuraTypeUI();
  }
  if (data.start_date) {
    const parts = data.start_date.split('-');
    startDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    document.getElementById('start-info').textContent =
      'Start tură de zi: ' +
      startDate.toLocaleDateString('ro-RO', { weekday: 'long', day: 'numeric', month: 'long' }) +
      ' · tiparul merge în ambele direcții';
  }
  if (data.co_days)     coDays     = deserializeSet(data.co_days);
  if (data.cm_days)     cmDays     = deserializeSet(data.cm_days);
  if (data.custom_days) customDays = deserializeSet(data.custom_days);
  if (data.double_days) doubleDays = deserializeObj(data.double_days);
  applyDubleSettings(data.pay_per_shift, data.double_multiplier);
  if (data.ics_settings) applyIcsSettings(deserializeObj(data.ics_settings));
  if (data.custom_ore) {
    const inp = document.getElementById('custom-ore-input');
    if (inp) inp.value = data.custom_ore;
  }
  if (data.shift_start_time) {
    const inp = document.getElementById('shift-start-time');
    if (inp) inp.value = data.shift_start_time.slice(0, 5); // "HH:MM:SS" -> "HH:MM"
  }
}

async function loadSettings() {
  if (!currentUser) return;
  const { data, error } = await sb
    .from('user_settings')
    .select('*')
    .eq('user_id', currentUser.id)
    .maybeSingle();
  if (error) { console.error('Eroare încărcare setări:', error); return; } // rămâne copia locală
  applySettingsRow(data);
  saveLocalState();
  recalc();
}

// ===== Edit Mode =====
function setEditMode(mode) {
  editMode = editMode === mode ? null : mode;
  updateEditModeUI();
}

function updateEditModeUI() {
  const btnCo = document.getElementById('btn-edit-co');
  const btnCm = document.getElementById('btn-edit-cm');
  const btnTura = document.getElementById('btn-apply-tura');
  const hint  = document.getElementById('edit-hint');
  btnCo.classList.toggle('active-edit-co', editMode === 'co');
  btnCm.classList.toggle('active-edit-cm', editMode === 'cm');
  btnTura.classList.toggle('active-edit-tura', editMode === 'tura');
  btnTura.textContent = editMode === 'tura' ? '✓ Gata' : '📅 Aplică tură pe mai multe zile';
  if (editMode === 'tura') {
    hint.textContent = isCustomMode()
      ? '✏️ Apasă pe zile pentru a le marca/demarca ca zile lucrate. Apasă „Gata” când termini.'
      : '✏️ Apasă pe o zi de tură de ZI pentru a seta începutul tiparului. Apasă „Gata” când termini.';
    hint.style.display = 'block';
  } else if (editMode === 'co') {
    hint.textContent = '✏️ Apasă pe orice zi pentru a marca/demarca CO (8h/zi)';
    hint.style.display = 'block';
  } else if (editMode === 'cm') {
    hint.textContent = '✏️ Apasă pe orice zi pentru a marca/demarca CM (8h/zi)';
    hint.style.display = 'block';
  } else {
    hint.style.display = 'none';
  }
}

// ===== Click pe zi =====
function handleDayClick(y, m, d) {
  const key = dayKey(y, m + 1, d);

  if (editMode === 'co') {
    if (cmDays.has(key)) cmDays.delete(key);
    coDays.has(key) ? coDays.delete(key) : coDays.add(key);
    recalc(); saveSettings(); return;
  }

  if (editMode === 'cm') {
    if (coDays.has(key)) coDays.delete(key);
    cmDays.has(key) ? cmDays.delete(key) : cmDays.add(key);
    recalc(); saveSettings(); return;
  }

  // Mod „Aplică tură pe mai multe zile”
  if (editMode === 'tura') {
    applyTura(y, m, d);
    return;
  }

  // Click normal → panoul zilei
  openDayPanel(y, m, d);
}

// Aplicare rapidă: custom = toggle zi lucrătoare, tipar = setare start tură
function applyTura(y, m, d) {
  const key = dayKey(y, m + 1, d);
  if (isCustomMode()) {
    if (coDays.has(key) || cmDays.has(key)) return; // nu suprascrie CO/CM
    customDays.has(key) ? customDays.delete(key) : customDays.add(key);
    recalc(); saveSettings(); return;
  }
  setStart(y, m, d);
}

// ===== Panoul zilei =====
let panelDay = null; // { y, m, d } — m e 0-based

function openDayPanel(y, m, d) {
  panelDay = { y, m, d };
  renderDayPanel();
  document.getElementById('day-modal').style.display = 'flex';
}

function closeDayPanel() {
  panelDay = null;
  document.getElementById('day-modal').style.display = 'none';
}

function describeShift(dateObj) {
  const key = dayKey(dateObj.getFullYear(), dateObj.getMonth() + 1, dateObj.getDate());
  if (coDays.has(key)) return 'Concediu de odihnă (CO)';
  if (cmDays.has(key)) return 'Concediu medical (CM)';
  const sh = getShift(dateObj);
  if (!sh) return 'Tiparul de tură nu e setat încă';
  if (sh.type === 'liber') return 'Zi liberă';
  const ore = getOrePerZi();
  if (sh.type === 'zi') return `Tură de zi · ${ore}h`;
  return (sh.label === 'A' ? 'Tură de după-amiază' : 'Tură de noapte') + ` · ${ore}h`;
}

// Format double_days (compatibil cu datele vechi):
//   număr        → dublă salvată înainte de selectorul de tip (tipul se deduce)
//   { ore, tip } → dublă cu tip ales, tip = 'zi' | 'noapte' (peste tură sau pe zi liberă)
function getDoubleOre(key) {
  const v = doubleDays[key];
  return Number(v && typeof v === 'object' ? v.ore : v) || 0;
}

// Implicit: peste o tură → tipul opus turei (Z → noapte, N → zi);
// pe zi liberă → Noapte în prima zi liberă după o tură de noapte, altfel Zi
function defaultDoubleTip(dateObj) {
  if (isWorkedDay(dateObj)) return getShift(dateObj).type === 'zi' ? 'noapte' : 'zi';
  const prev = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate() - 1);
  const sh = getShift(prev);
  return (isWorkedDay(prev) && sh.type === 'noapte' && sh.label !== 'A') ? 'noapte' : 'zi';
}

function getDoubleTip(key, dateObj) {
  const v = doubleDays[key];
  if (v && typeof v === 'object' && (v.tip === 'zi' || v.tip === 'noapte')) return v.tip;
  return defaultDoubleTip(dateObj);
}

function setDouble(key, dateObj, ore, tip) {
  doubleDays[key] = { ore, tip: tip || getDoubleTip(key, dateObj) };
}

function renderDayPanel() {
  if (!panelDay) return;
  const { y, m, d } = panelDay;
  const dateObj = new Date(y, m, d);
  const key     = dayKey(y, m + 1, d);
  const worked  = isWorkedDay(dateObj);
  const isDubla = key in doubleDays;

  const title = dateObj.toLocaleDateString('ro-RO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  document.getElementById('day-modal-title').textContent = title.charAt(0).toUpperCase() + title.slice(1);
  document.getElementById('day-modal-shift').textContent = describeShift(dateObj);

  // Acțiune pe o singură zi (echivalentul aplicării rapide)
  const actionBtn = document.getElementById('day-modal-action');
  const isLeave = coDays.has(key) || cmDays.has(key);
  const isStart = startDate && dateObj.toDateString() === startDate.toDateString();
  if (isCustomMode()) {
    actionBtn.style.display = isLeave ? 'none' : 'block';
    actionBtn.textContent = customDays.has(key) ? 'Marchează ca zi liberă' : 'Marchează ca zi lucrată';
  } else {
    actionBtn.style.display = isStart ? 'none' : 'block';
    actionBtn.textContent = 'Setează ca început de tipar (tură de ZI)';
  }

  const check = document.getElementById('day-double-check');
  check.checked  = isDubla;
  check.disabled = isLeave && !isDubla; // blocată doar pe CO/CM; o dublă veche poate fi mereu debifată

  const oreInp = document.getElementById('day-double-ore');
  oreInp.value = isDubla ? getDoubleOre(key) : DOUBLE_ORE_DEFAULT;
  document.getElementById('day-double-ore-row').style.display = isDubla ? 'flex' : 'none';

  // Tipul dublei (Zi/Noapte), atât peste tură cât și pe zi liberă
  const onFreeDay = isDubla && !worked && !isLeave;
  const showTip   = isDubla && !isLeave;
  document.getElementById('day-double-tip-row').style.display = showTip ? 'flex' : 'none';
  if (showTip) document.getElementById('day-double-tip').value = getDoubleTip(key, dateObj);

  const plataDubla = `${payPerShift} × ${doubleMultiplier} = ${payPerShift * doubleMultiplier} lei`;
  const note = document.getElementById('day-double-note');
  if (payPerShift == null && !isLeave && (worked || isDubla)) {
    note.textContent = isDubla
      ? 'Dublă: o singură zi lucrată. Setează plata pe tură ca să vezi plata zilei.'
      : 'Setează plata pe tură ca să vezi plata zilei.';
  } else if (isLeave) {
    note.textContent = isDubla
      ? 'Ziua e CO/CM, deci dubla nu se ia în calcul.'
      : 'Dubla nu se poate marca pe o zi de CO/CM.';
  } else if (onFreeDay) {
    note.textContent = `Chemat într-o zi liberă: plata zilei ${plataDubla} (o zi lucrată).`;
  } else if (isDubla) {
    note.textContent = `Plata zilei: ${plataDubla} (o singură zi lucrată).`;
  } else if (worked) {
    note.textContent = `Plata zilei: ${payPerShift} lei.`;
  } else {
    note.textContent = 'Zi liberă. Bifează „Dublă” dacă ai fost chemat la muncă.';
  }
}

function onDayDoubleToggle() {
  if (!panelDay) return;
  const key = dayKey(panelDay.y, panelDay.m + 1, panelDay.d);
  const dateObj = new Date(panelDay.y, panelDay.m, panelDay.d);
  if (document.getElementById('day-double-check').checked) {
    const ore = parseFloat(document.getElementById('day-double-ore').value);
    setDouble(key, dateObj, ore > 0 ? ore : DOUBLE_ORE_DEFAULT);
  } else {
    delete doubleDays[key];
  }
  recalc(); saveSettings(); renderDayPanel();
}

function onDayDoubleOreChange() {
  if (!panelDay) return;
  const key = dayKey(panelDay.y, panelDay.m + 1, panelDay.d);
  if (!(key in doubleDays)) return;
  const ore = parseFloat(document.getElementById('day-double-ore').value);
  setDouble(key, new Date(panelDay.y, panelDay.m, panelDay.d), ore > 0 ? ore : DOUBLE_ORE_DEFAULT);
  recalc(); saveSettings(); renderDayPanel();
}

function onDayDoubleTipChange() {
  if (!panelDay) return;
  const key = dayKey(panelDay.y, panelDay.m + 1, panelDay.d);
  if (!(key in doubleDays)) return;
  setDouble(key, new Date(panelDay.y, panelDay.m, panelDay.d), getDoubleOre(key) || DOUBLE_ORE_DEFAULT,
            document.getElementById('day-double-tip').value);
  recalc(); saveSettings(); renderDayPanel();
}

function onDayPanelAction() {
  if (!panelDay) return;
  applyTura(panelDay.y, panelDay.m, panelDay.d);
  renderDayPanel();
}

// ===== Setare zi de start =====
function setStart(y, m, d) {
  startDate = new Date(y, m, d);
  document.getElementById('start-info').textContent =
    'Start tură de zi: ' +
    startDate.toLocaleDateString('ro-RO', { weekday: 'long', day: 'numeric', month: 'long' }) +
    ' · tiparul merge în ambele direcții';
  recalc();
  saveSettings();
}

// ===== UI pentru tipul de tură (afișare custom panel) =====
function updateTuraTypeUI() {
  const val = document.getElementById('tura-type').value;
  const customPanel = document.getElementById('custom-panel');
  const startInfo   = document.getElementById('start-info');
  if (val === 'custom') {
    customPanel.style.display = 'block';
    startInfo.textContent = '👆 Bifează zilele în care lucrezi: apasă „Aplică tură pe mai multe zile”, apoi pe zile. Apasă pe o zi pentru detalii și dublă.';
  } else {
    customPanel.style.display = 'none';
    if (!startDate) {
      startInfo.textContent = 'Apasă „Aplică tură pe mai multe zile”, apoi pe o zi de tură de ZI pentru a seta tiparul.';
    }
  }
}

// ===== Zi lucrată (sursă unică pentru ore și salariu) =====
function isWorkedDay(dateObj) {
  const key = dayKey(dateObj.getFullYear(), dateObj.getMonth() + 1, dateObj.getDate());
  if (coDays.has(key) || cmDays.has(key)) return false;
  const sh = getShift(dateObj);
  return !!(sh && (sh.type === 'zi' || sh.type === 'noapte'));
}

// Descrierea unei zile — sursa unică pentru computeMonth (ore/salariu) și exportul .ics
function classifyDay(dateObj) {
  const key = dayKey(dateObj.getFullYear(), dateObj.getMonth() + 1, dateObj.getDate());
  if (coDays.has(key)) return { key, leave: 'co', shift: null, dubla: null };
  if (cmDays.has(key)) return { key, leave: 'cm', shift: null, dubla: null };
  const shift = isWorkedDay(dateObj) ? getShift(dateObj) : null;
  const dubla = (key in doubleDays)
    ? { ore: getDoubleOre(key), tip: getDoubleTip(key, dateObj) }
    : null;
  return { key, leave: null, shift, dubla };
}

// Dubla = o singură zi lucrată plătită payPerShift × doubleMultiplier, fie peste
// o tură existentă, fie pe o zi liberă (chemat la muncă). Pe CO/CM e ignorată
// (păstrată în date). Orele dublei apar doar la ore suplimentare.
function computeMonth(year, month) {
  const days  = new Date(year, month + 1, 0).getDate();
  const oreZi = getOrePerZi();
  const r = { oreLucrate: 0, oreCo: 0, oreCm: 0, zileLucrate: 0, tureNormale: 0, duble: 0, oreSuplDuble: 0 };

  for (let d = 1; d <= days; d++) {
    const c = classifyDay(new Date(year, month, d));

    if (c.leave === 'co') {
      r.oreCo += 8;
    } else if (c.leave === 'cm') {
      r.oreCm += 8;
    } else {
      if (c.shift) r.oreLucrate += oreZi;
      if (c.shift || c.dubla) r.zileLucrate++;
      if (c.dubla) {
        r.duble++;
        r.oreSuplDuble += c.dubla.ore;
      } else if (c.shift) {
        r.tureNormale++;
      }
    }
  }

  r.salariu = payPerShift == null
    ? null // plata necompletată → fără sumă
    : r.tureNormale * payPerShift + r.duble * payPerShift * doubleMultiplier;
  return r;
}

// ===== Recalculare =====
function recalc() {
  const year  = viewYear;
  const month = viewMonth;
  const m = computeMonth(year, month);

  const totalPontat = m.oreLucrate + m.oreCo + m.oreCm;
  const norma = getNorma(year, month);
  const extra = totalPontat - norma;

  const showStats = isCustomMode() || !!startDate;
  if (showStats) {
    document.getElementById('ore-lucrate').textContent = totalPontat;
    document.getElementById('norma').textContent       = norma;
    const elExtra = document.getElementById('ore-extra');
    elExtra.textContent = (extra >= 0 ? '+' : '') + extra;
    elExtra.style.color = extra >= 0 ? '#1D9E75' : '#e53e3e';

    if (!calculFacutTrimis) {
      calculFacutTrimis = true;
      if (typeof window.gtag === 'function') gtag('event', 'calcul_facut');
      scheduleEmailCapture();
    }
  }

  renderSalariu(m, showStats);
  if (isIcsPanelOpen()) prepareIcs(); // fișierul .ics rămâne la zi cu turele
  updateCoBadge();
  renderCal();
}

// ===== Salariu pe ture (citește același rezultat ca statisticile de ore) =====
function renderSalariu(m, show) {
  const set = (id, v) => { document.getElementById(id).textContent = show ? v : '—'; };
  set('sal-ture-normale', m.tureNormale);
  set('sal-duble',        m.duble);
  set('sal-ore-supl',     m.oreSuplDuble);
  set('sal-zile-lucrate', m.zileLucrate);
  const missing = m.salariu == null;
  document.getElementById('sal-total-box').style.display     = missing ? 'none' : 'flex';
  document.getElementById('sal-total-missing').style.display = missing ? 'flex' : 'none';
  if (!missing) set('sal-total', Math.round(m.salariu * 100) / 100);
}

function openSalariuSetari() {
  if (document.getElementById('sal-panel-setari').style.display === 'none') toggleSalariuPanel('setari');
  document.getElementById('pay-per-shift').focus();
}

// Secțiuni pliabile (Detalii / Setări plată) — starea nu se salvează, implicit închise
function toggleSalariuPanel(name) {
  const panel = document.getElementById('sal-panel-' + name);
  const open  = panel.style.display === 'none';
  panel.style.display = open ? (name === 'detalii' ? 'grid' : 'block') : 'none';
  const btn = document.getElementById('btn-sal-' + name);
  btn.textContent = (name === 'detalii' ? 'Detalii' : 'Setări plată') + (open ? ' ▴' : ' ▾');
  btn.classList.toggle('active-edit-tura', open);
}

function updateCoBadge() {
  const totalCo = coDays.size;
  const totalCm = cmDays.size;
  const spCo = document.querySelector('#btn-edit-co .co-count');
  const spCm = document.querySelector('#btn-edit-cm .cm-count');
  if (spCo) spCo.textContent = totalCo > 0 ? ` · ${totalCo}z` : '';
  if (spCm) spCm.textContent = totalCm > 0 ? ` · ${totalCm}z` : '';
}

// ===== Render calendar =====
function renderCal() {
  const year  = viewYear;
  const month = viewMonth;

  const lbl = new Date(year, month, 1).toLocaleDateString('ro-RO', { month: 'long', year: 'numeric' });
  document.getElementById('month-label').textContent = lbl.charAt(0).toUpperCase() + lbl.slice(1);

  const firstDay = new Date(year, month, 1).getDay();
  const offset   = firstDay === 0 ? 6 : firstDay - 1;
  const days     = new Date(year, month + 1, 0).getDate();
  const names    = ['Lu', 'Ma', 'Mi', 'Jo', 'Vi', 'Sâ', 'Du'];

  let html = names.map(n => `<div class="cal-day-name">${n}</div>`).join('');
  for (let i = 0; i < offset; i++) html += '<div class="day empty"></div>';

  for (let d = 1; d <= days; d++) {
    const dateObj = new Date(year, month, d);
    const sh      = getShift(dateObj);
    const hol     = getHoliday(year, month + 1, d);
    const legal   = getLegalHoliday(year, month + 1, d);
    const isToday = dateObj.toDateString() === today.toDateString();
    const isStart = startDate && dateObj.toDateString() === startDate.toDateString();
    const key     = dayKey(year, month + 1, d);
    const isCo    = coDays.has(key);
    const isCm    = cmDays.has(key);
    const isDubla = (key in doubleDays) && !isCo && !isCm;
    const dublaLibera = isDubla && !isWorkedDay(dateObj);

    let cls = 'day';
    if (isCo)       cls += ' co';
    else if (isCm)  cls += ' cm';
    else if (sh)    cls += ' ' + sh.type;
    else            cls += ' liber';

    if (isToday) cls += ' today';
    if (isStart) cls += ' start-sel';
    if (legal)   cls += ' legal-holiday';
    if (isDubla) cls += ' dubla';

    // În mod custom, zilele lucrătoare au cursor diferit
    if (isCustomMode() && !isCo && !isCm) cls += ' custom-clickable';

    const badge    = dublaLibera
      ? `<span class="shift-badge">${getDoubleTip(key, dateObj) === 'noapte' ? 'N' : 'Z'}</span>`
      : (!isCo && !isCm && sh && sh.label) ? `<span class="shift-badge">${sh.label}</span>` : '';
    const coBadge  = isCo ? `<span class="hol-name hol-co">CO</span>` : '';
    const cmBadge  = isCm ? `<span class="hol-name hol-cm">CM</span>` : '';
    const dblBadge = isDubla ? `<span class="hol-name hol-dubla">DUBLĂ</span>` : '';
    const legalBdg = legal ? `<span class="hol-name hol-legal" title="${legal}">ZL</span>` : '';
    const holHtml  = hol   ? `<span class="hol-name hol-${hol.type}">${hol.name}</span>` : '';

    html += `<div class="${cls}" data-y="${year}" data-m="${month}" data-d="${d}">${d}${badge}${dblBadge}${coBadge}${cmBadge}${legalBdg}${holHtml}</div>`;
  }

  document.getElementById('cal').innerHTML = html;
  document.getElementById('cal').querySelectorAll('.day:not(.empty)').forEach(el => {
    el.addEventListener('click', () => {
      handleDayClick(parseInt(el.dataset.y), parseInt(el.dataset.m), parseInt(el.dataset.d));
    });
  });
}

// ===== Navigare luni =====
function changeMonth(dir) {
  viewMonth += dir;
  if (viewMonth > 11) { viewMonth = 0; viewYear++; }
  if (viewMonth < 0)  { viewMonth = 11; viewYear--; }
  saveViewMonth();
  recalc();
}

// ===== Toggle filtre =====
function toggleFilter(type) {
  filters[type] = !filters[type];
  const btn = document.getElementById('btn-' + type);
  btn.className = filters[type] ? 'filter-btn active-' + type : 'filter-btn';
  recalc();
}

// ===== PRINT =====
function doPrint() {
  window.print();
}

// ===== Funcții Premium (flag) =====
// Marcaj pentru funcțiile care vor fi Premium. Deocamdată totul e deblocat pentru
// toți (testare) — plata/blocarea nu sunt implementate încă.
const PREMIUM_FEATURES = { icsExport: true };
function isPremiumFeature(name) { return !!PREMIUM_FEATURES[name]; }
function isFeatureUnlocked(name) { return true; }

// ===== EXPORT CALENDAR (.ics, RFC 5545) =====
// Ore cu TZID=Europe/Bucharest + VTIMEZONE (reguli UE de oră de vară), ca
// evenimentele să rămână la ora locală corectă pe iPhone/Google/Android
// chiar dacă telefonul e în alt fus orar.
const ICS_TZ = 'Europe/Bucharest';
const ICS_VTIMEZONE = [
  'BEGIN:VTIMEZONE',
  'TZID:Europe/Bucharest',
  'X-LIC-LOCATION:Europe/Bucharest',
  'BEGIN:DAYLIGHT',
  'TZOFFSETFROM:+0200',
  'TZOFFSETTO:+0300',
  'TZNAME:EEST',
  'DTSTART:19700329T030000',
  'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU',
  'END:DAYLIGHT',
  'BEGIN:STANDARD',
  'TZOFFSETFROM:+0300',
  'TZOFFSETTO:+0200',
  'TZNAME:EET',
  'DTSTART:19701025T040000',
  'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU',
  'END:STANDARD',
  'END:VTIMEZONE',
];

const pad2 = n => String(n).padStart(2, '0');

function icsEscape(text) {
  return String(text)
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

// Împăturire la 75 de octeți (UTF-8), fără a tăia un caracter multi-octet
function icsFold(line) {
  const enc = new TextEncoder();
  if (enc.encode(line).length <= 75) return line;
  const parts = [];
  let cur = '', curBytes = 0, limit = 75;
  for (const ch of line) {
    const b = enc.encode(ch).length;
    if (curBytes + b > limit) {
      parts.push(cur);
      cur = ''; curBytes = 0; limit = 74; // liniile de continuare încep cu un spațiu
    }
    cur += ch; curBytes += b;
  }
  parts.push(cur);
  return parts.join('\r\n ');
}

function minutesOf(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

// Dată-oră „de perete” (fără fus) → YYYYMMDDTHHMMSS; aritmetica e în UTC ca
// să nu fie afectată de fusul/ora de vară a telefonului.
function icsLocal(y, m, d, minutes) {
  const t = new Date(Date.UTC(y, m, d, 0, minutes));
  return `${t.getUTCFullYear()}${pad2(t.getUTCMonth() + 1)}${pad2(t.getUTCDate())}T${pad2(t.getUTCHours())}${pad2(t.getUTCMinutes())}00`;
}

function icsDate(y, m, d) {
  const t = new Date(Date.UTC(y, m, d));
  return `${t.getUTCFullYear()}${pad2(t.getUTCMonth() + 1)}${pad2(t.getUTCDate())}`;
}

function icsUtcStamp(date) {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

// Alarma sună la ora aleasă în ziua turei → TRIGGER relativ față de start.
// Dacă ora alarmei nu e înainte de start, alarma e în seara precedentă.
function alarmOffsetMin(startMin, alarmHHMM) {
  let diff = startMin - minutesOf(alarmHHMM);
  if (diff <= 0) diff += 24 * 60;
  return diff;
}

function icsAlarm(offsetMin, text) {
  return [
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${icsEscape(text)}`,
    `TRIGGER:-PT${offsetMin}M`,
    'END:VALARM',
  ];
}

// Evenimentele dintr-un interval de luni, din aceeași sursă ca zilele lucrate (classifyDay)
function buildIcsEvents(year, month, monthsCount) {
  const events = [];
  const oreTura = getOrePerZi();
  for (let i = 0; i < monthsCount; i++) {
    const y = new Date(year, month + i, 1).getFullYear();
    const m = new Date(year, month + i, 1).getMonth();
    const days = new Date(y, m + 1, 0).getDate();
    for (let d = 1; d <= days; d++) {
      const c = classifyDay(new Date(y, m, d));
      const iso = `${y}-${pad2(m + 1)}-${pad2(d)}`;
      if (c.leave) {
        if (icsSettings.includeLeave) events.push({ allDay: true, y, m, d, uid: `${iso}-${c.leave}`, summary: c.leave.toUpperCase() });
        continue;
      }
      if (c.shift) {
        const tip = c.shift.type; // 'zi' | 'noapte'
        events.push({ y, m, d, tip, durMin: oreTura * 60, uid: `${iso}-${tip}`, summary: tip === 'zi' ? 'Tură zi' : 'Tură noapte' });
      }
      if (c.dubla) {
        const tip = c.dubla.tip;
        events.push({ y, m, d, tip, durMin: (c.dubla.ore || DOUBLE_ORE_DEFAULT) * 60, uid: `${iso}-dubla-${tip}`, summary: tip === 'zi' ? 'Dublă zi' : 'Dublă noapte' });
      }
    }
  }
  return events;
}

function buildIcs(events) {
  const stamp = icsUtcStamp(new Date());
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//calculatorture.ro//Calculator Ture//RO',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Ture',
    `X-WR-TIMEZONE:${ICS_TZ}`,
    ...ICS_VTIMEZONE,
  ];

  for (const ev of events) {
    lines.push('BEGIN:VEVENT', `UID:${ev.uid}@calculatorture.ro`, `DTSTAMP:${stamp}`);
    if (ev.allDay) {
      lines.push(
        `DTSTART;VALUE=DATE:${icsDate(ev.y, ev.m, ev.d)}`,
        `DTEND;VALUE=DATE:${icsDate(ev.y, ev.m, ev.d + 1)}`,
        `SUMMARY:${icsEscape(ev.summary)}`,
        'TRANSP:TRANSPARENT',
      );
    } else {
      const startHHMM = ev.tip === 'zi' ? icsSettings.dayStart : icsSettings.nightStart;
      const startMin  = minutesOf(startHHMM);
      const alarm1    = alarmOffsetMin(startMin, ev.tip === 'zi' ? icsSettings.alarmDay : icsSettings.alarmNight);
      lines.push(
        `DTSTART;TZID=${ICS_TZ}:${icsLocal(ev.y, ev.m, ev.d, startMin)}`,
        `DTEND;TZID=${ICS_TZ}:${icsLocal(ev.y, ev.m, ev.d, startMin + ev.durMin)}`,
        `SUMMARY:${icsEscape(ev.summary)}`,
        `DESCRIPTION:${icsEscape(`${ev.summary}, start la ${startHHMM}. Generat de calculatorture.ro; dacă schimbi turele, exportă din nou.`)}`,
        ...icsAlarm(alarm1, `${ev.summary} la ${startHHMM}`),
      );
      if (icsSettings.alarm2) {
        lines.push(...icsAlarm(alarm1 + icsSettings.alarm2Min, `${ev.summary} la ${startHHMM}`));
      }
    }
    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');
  return lines.map(icsFold).join('\r\n') + '\r\n';
}

function showIcsStatus(msg, type) {
  const el = document.getElementById('ics-status');
  el.textContent = msg;
  el.className = 'push-status' + (type ? ' ' + type : '');
  el.style.display = 'block';
}

// Fișierul se generează dinainte (la deschiderea secțiunii, la schimbarea
// setărilor și la recalculare), ca la click partajarea/descărcarea să pornească
// imediat din gestul utilizatorului (cerință iOS).
let icsPrepared = null;

function prepareIcs() {
  readIcsInputs();
  const monthsCount = parseInt(document.getElementById('ics-range').value, 10) || 1;
  const events = buildIcsEvents(viewYear, viewMonth, monthsCount);
  const text = buildIcs(events);
  const filename = `ture-${viewYear}-${pad2(viewMonth + 1)}${monthsCount > 1 ? '-' + monthsCount + 'luni' : ''}.ics`;
  let file = null;
  try { file = new File([text], filename, { type: 'text/calendar' }); } catch { /* File indisponibil */ }
  icsPrepared = { text, file, filename, monthsCount, events, withAlarm: events.filter(e => !e.allDay).length };
  return icsPrepared;
}

function isIcsPanelOpen() {
  const panel = document.getElementById('ics-panel');
  return !!panel && panel.style.display !== 'none';
}

// iPadOS se prezintă ca Mac; îl tratăm ca iOS pentru export
function isIOSLike() {
  return isIOSDevice() || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

// Android / calculator: descărcare cu <a download> și Blob (funcționează acolo)
function downloadIcsBlob(p) {
  const url = URL.createObjectURL(new Blob([p.text], { type: 'text/calendar;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = p.filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

// Safari pe iPhone: formular POST către /api/ics, care răspunde cu
// Content-Type text/calendar → Safari deschide importul nativ în Calendar.
function submitIcsForm(p) {
  const form = document.createElement('form');
  form.method = 'POST';
  form.action = '/api/ics?f=' + encodeURIComponent(p.filename);
  form.style.display = 'none';
  const field = document.createElement('textarea');
  field.name = 'ics';
  field.value = p.text;
  form.appendChild(field);
  document.body.appendChild(form);
  form.submit();
  form.remove();
}

const ICS_STANDALONE_MSG = 'Pe iPhone, exportul în Calendar merge din Safari. Deschide app.calculatorture.ro în Safari, loghează-te și apasă din nou Exportă în calendar.';

function icsExportDone(p, how) {
  showIcsStatus(`✓ ${p.events.length} evenimente ${how} (${p.withAlarm} cu alarmă).`, 'success');
  if (typeof window.gtag === 'function') gtag('event', 'export_ics', { luni: p.monthsCount });
}

// Fără await înainte de share/descărcare: iOS cere apelul direct din click.
function exportIcs() {
  if (!isFeatureUnlocked('icsExport')) return;
  const p = icsPrepared || prepareIcs();
  if (p.events.length === 0) {
    showIcsStatus('Nu există ture în perioada aleasă. Setează mai întâi tiparul de tură.', 'error');
    return;
  }

  try {
    if (isIOSLike() && isStandalonePWA()) {
      // Aplicația de pe ecranul principal: iOS nu oferă Calendar nici la descărcare,
      // nici în fereastra de partajare → trimitem utilizatorul în Safari.
      showIcsStatus(ICS_STANDALONE_MSG);
      return;
    }
    if (isIOSLike()) {
      submitIcsForm(p);
      icsExportDone(p, 'trimise către Calendar');
      return;
    }
    downloadIcsBlob(p);
    icsExportDone(p, 'exportate');
  } catch (err) {
    console.error('Eroare export .ics:', err);
    showIcsStatus('Nu am putut crea fișierul. Încearcă din nou.', 'error');
  }
}

function toggleIcsPanel() {
  const panel = document.getElementById('ics-panel');
  const open  = panel.style.display === 'none';
  panel.style.display = open ? 'block' : 'none';
  if (open) prepareIcs();
  const btn = document.getElementById('btn-ics-toggle');
  btn.textContent = '📅 Exportă în calendar' + (open ? ' ▴' : ' ▾');
  btn.classList.toggle('active-edit-tura', open);
}

// ===== Salariu net în panou (aplicația instalată) =====
// În aplicația de pe ecranul principal, navigarea spre calculator-salariu.html și
// înapoi reîncarcă aplicația și pe iPhone se pierd datele. Deschidem pagina într-un
// panou peste aplicație, care rămâne încărcată în spate. În browser, link normal.
function isAppHomeLink(href) {
  try {
    const u = new URL(href, location.href);
    return u.origin === location.origin && (u.pathname === '/' || u.pathname === '/index.html');
  } catch { return false; }
}

function openSalaryPanel(url) {
  const panel = document.getElementById('salary-panel');
  const frame = document.getElementById('salary-panel-frame');
  if (!frame.getAttribute('src')) frame.setAttribute('src', url);
  panel.style.display = 'flex';
  document.body.style.overflow = 'hidden';
  fitSalaryPanel();
}

function closeSalaryPanel() {
  document.getElementById('salary-panel').style.display = 'none';
  document.body.style.overflow = '';
}

// Cu tastatura deschisă, panoul ia înălțimea zonei vizibile, ca și câmpurile să rămână accesibile
function fitSalaryPanel() {
  const panel = document.getElementById('salary-panel');
  if (panel.style.display === 'none') return;
  const vv = window.visualViewport;
  panel.style.height = vv ? vv.height + 'px' : '';
  panel.style.top    = vv ? vv.offsetTop + 'px' : '';
}
if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', fitSalaryPanel);
  window.visualViewport.addEventListener('scroll', fitSalaryPanel);
}

document.addEventListener('click', (e) => {
  if (!isStandalonePWA()) return;
  const a = e.target.closest && e.target.closest('a[href]');
  if (!a) return;
  const u = new URL(a.getAttribute('href'), location.href);
  if (u.origin === location.origin && u.pathname === '/calculator-salariu.html') {
    e.preventDefault();
    openSalaryPanel(u.pathname);
  }
});

// Link-urile „← Calculator Ture” din panou doar închid panoul (fără reîncărcare)
document.getElementById('salary-panel-frame').addEventListener('load', () => {
  const frame = document.getElementById('salary-panel-frame');
  let doc;
  try { doc = frame.contentDocument; } catch { return; }
  if (!doc) return;
  if (isAppHomeLink(frame.contentWindow.location.href)) { // a ajuns totuși la aplicație
    closeSalaryPanel();
    frame.setAttribute('src', '/calculator-salariu.html');
    return;
  }
  doc.addEventListener('click', (e) => {
    const a = e.target.closest && e.target.closest('a[href]');
    if (a && isAppHomeLink(a.href)) {
      e.preventDefault();
      closeSalaryPanel();
    }
  });
});

// ===== TEMPORAR: indicator de diagnostic =====
// Pornit cu ?debug=1 (oprit cu ?debug=0) sau cu 5 atingeri pe titlu; ținut minte
// în localStorage, ca să apară și la pornirile aplicației de pe ecranul principal.
const DEBUG_KEY = 'ture-debug';
let debugAuthLine = 'auth: se așteaptă…';

function isDebugOn() {
  try { return localStorage.getItem(DEBUG_KEY) === '1'; } catch { return false; }
}

async function renderDebug() {
  const box = document.getElementById('debug-box');
  if (!isDebugOn()) { box.style.display = 'none'; return; }
  let keys = [];
  try { keys = Object.keys(localStorage).filter(k => k.startsWith(LOCAL_STATE_PREFIX)); } catch { /* */ }
  const sessionId = getStoredSessionUserId();
  let sessionRaw = false;
  try { sessionRaw = !!localStorage.getItem(sb.auth.storageKey); } catch { /* */ }
  const nav = (performance.getEntriesByType('navigation')[0] || {}).type || '?';
  let cache = '?';
  try { cache = (await caches.keys()).join(',') || 'niciunul'; } catch { /* */ }
  const short = id => id === 'anon' ? 'anon' : id.slice(0, 8) + '…';
  box.textContent = [
    'DEBUG (temporar)',
    `standalone: ${isStandalonePWA() ? 'da' : 'nu'} · nav: ${nav} · SW: ${navigator.serviceWorker?.controller ? 'activ' : 'nu'} · cache: ${cache}`,
    `cont citit la pornire: ${short(stateOwner)}`,
    `sesiune Supabase în localStorage: ${sessionRaw ? 'găsită' : 'lipsă'}${sessionId ? ' (' + short(sessionId) + ')' : ''}`,
    `ture-state pentru cont: ${readLocalState(stateOwner) ? 'există' : 'LIPSĂ'} · chei ture-state: ${keys.map(k => short(k.slice(LOCAL_STATE_PREFIX.length))).join(', ') || 'niciuna'}`,
    `ture-view: ${(() => { try { return localStorage.getItem(VIEW_KEY) ? 'există' : 'lipsă'; } catch { return '?'; } })()} · ${debugAuthLine}`,
  ].join('\n');
  box.style.display = 'block';
}

(function initDebug() {
  const flag = new URLSearchParams(location.search).get('debug');
  try {
    if (flag === '1') localStorage.setItem(DEBUG_KEY, '1');
    if (flag === '0') localStorage.removeItem(DEBUG_KEY);
  } catch { /* */ }
  let taps = 0, timer = null;
  document.querySelector('.app-header h1').addEventListener('click', () => {
    taps++;
    clearTimeout(timer);
    timer = setTimeout(() => { taps = 0; }, 1500);
    if (taps >= 5) {
      taps = 0;
      try { isDebugOn() ? localStorage.removeItem(DEBUG_KEY) : localStorage.setItem(DEBUG_KEY, '1'); } catch { /* */ }
      renderDebug();
    }
  });
})();

// ===== PDF FREEMIUM =====
// Logică: fără cont → 1 lună gratuit în sesiune (localStorage)
// Cu email înregistrat → nelimitat

const PDF_FREE_KEY = 'ture-pdf-used';
const PDF_EMAIL_KEY = 'ture-pdf-email';
const PDF_DATE_KEY  = 'ture-pdf-date';

function canExportPdfFree() {
  // Dacă e logat → mereu poate
  if (currentUser) return true;
  // Dacă a dat email și e în termenul de 1 lună
  const email = localStorage.getItem(PDF_EMAIL_KEY);
  const dateStr = localStorage.getItem(PDF_DATE_KEY);
  if (email && dateStr) {
    const regDate = new Date(dateStr);
    const now = new Date();
    const diffDays = (now - regDate) / (1000 * 60 * 60 * 24);
    if (diffDays <= 30) return true;
    return false; // expirat
  }
  return false;
}

function isPdfEmailRegistered() {
  return !!localStorage.getItem(PDF_EMAIL_KEY);
}

function registerPdfEmail(email) {
  localStorage.setItem(PDF_EMAIL_KEY, email);
  localStorage.setItem(PDF_DATE_KEY, new Date().toISOString());
}

async function savePdfEmailToSupabase(email) {
  try {
    await sb.from('pdf_subscribers').upsert({ email, registered_at: new Date().toISOString() }, { onConflict: 'email' });
  } catch(e) { /* non-critical */ }
}

function tryExportPdf() {
  if (currentUser) {
    // Logat → export direct
    generateAndDownloadPdf();
    return;
  }

  if (canExportPdfFree()) {
    generateAndDownloadPdf();
    return;
  }

  // Arată modal de înregistrare email
  showPdfModal();
}

function showPdfModal() {
  const alreadyExpired = isPdfEmailRegistered();
  document.getElementById('pdf-modal').style.display = 'flex';
  const sub = document.getElementById('pdf-modal-sub');
  if (alreadyExpired) {
    sub.textContent = 'Luna ta gratuită a expirat. Înregistrează-te cu emailul pentru un an întreg de export PDF gratuit.';
  } else {
    sub.textContent = 'Introdu adresa ta de email și primești 1 an de export PDF gratuit.';
  }
}

function closePdfModal() {
  document.getElementById('pdf-modal').style.display = 'none';
}

async function confirmPdfEmail() {
  const email = document.getElementById('pdf-email-input').value.trim();
  if (!email || !email.includes('@')) {
    document.getElementById('pdf-modal-error').textContent = 'Te rog introdu un email valid.';
    document.getElementById('pdf-modal-error').style.display = 'block';
    return;
  }
  registerPdfEmail(email);
  await savePdfEmailToSupabase(email);
  closePdfModal();
  generateAndDownloadPdf();
}

function generateAndDownloadPdf() {
  // Folosim print-to-PDF nativ — zero dependențe, zero erori
  // Setăm temporar light mode pentru print corect
  const currentTheme = document.documentElement.getAttribute('data-theme');
  document.documentElement.setAttribute('data-theme', 'light');
  document.body.classList.add('printing-pdf');

  setTimeout(() => {
    window.print();
    // Restaurăm tema după ce dialogul de print s-a deschis
    setTimeout(() => {
      document.documentElement.setAttribute('data-theme', currentTheme);
      document.body.classList.remove('printing-pdf');
    }, 500);
  }, 100);
}

// ===== Email Capture (slide-in, MVP fără remindere — vezi calculatorture) =====
const EMAIL_CAPTURE_SEEN_KEY = 'email_capture_seen';

function scheduleEmailCapture() {
  if (localStorage.getItem(EMAIL_CAPTURE_SEEN_KEY)) return;
  setTimeout(showEmailCaptureCard, 800);
}

function showEmailCaptureCard() {
  if (localStorage.getItem(EMAIL_CAPTURE_SEEN_KEY)) return;
  localStorage.setItem(EMAIL_CAPTURE_SEEN_KEY, '1');
  const card = document.getElementById('email-capture-card');
  if (!card) return;
  card.style.display = 'block';
  requestAnimationFrame(() => card.classList.add('visible'));
  if (typeof window.gtag === 'function') gtag('event', 'popup_email_afisat');
}

function closeEmailCaptureCard() {
  localStorage.setItem(EMAIL_CAPTURE_SEEN_KEY, '1');
  const card = document.getElementById('email-capture-card');
  if (!card) return;
  card.classList.remove('visible');
  setTimeout(() => { card.style.display = 'none'; }, 350);
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function submitEmailCapture() {
  const input = document.getElementById('email-capture-input');
  const errEl = document.getElementById('email-capture-error');
  const email = input.value.trim();

  if (!isValidEmail(email)) {
    errEl.textContent = 'Te rog introdu un email valid.';
    errEl.style.display = 'block';
    return;
  }
  errEl.style.display = 'none';

  const btn = document.querySelector('#email-capture-body .email-capture-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Se trimite...'; }

  try {
    // Insert simplu, nu upsert: cu RLS doar-INSERT (fără SELECT pentru anon),
    // varianta upsert(ignoreDuplicates) a PostgREST eșuează cu 42501 — are
    // nevoie implicit de o verificare gen SELECT pe care rolul anon n-o are.
    // Constraint-ul unic pe email tratează duplicatele (23505), prins mai jos.
    const { error } = await sb.from('email_leads').insert({ email, source: 'popup_calculator' });
    // Duplicat (email deja existent) sau orice altă eroare — tratăm silențios
    // ca succes față de vizitator; nu are rost să-i spunem că e duplicat.
    if (error && error.code !== '23505') {
      console.error('Eroare salvare email lead:', error);
    } else {
      if (typeof window.gtag === 'function') gtag('event', 'email_lasat');
    }
  } catch (err) {
    console.error('Eroare salvare email lead:', err);
  }

  document.getElementById('email-capture-body').style.display = 'none';
  document.getElementById('email-capture-success').style.display = 'block';
  setTimeout(closeEmailCaptureCard, 3000);
}

// ===== Event Listeners =====
document.getElementById('tura-type').addEventListener('change', () => {
  updateTuraTypeUI();
  updateEditModeUI();
  recalc();
  saveSettings();
});

document.getElementById('prev-month').addEventListener('click', () => changeMonth(-1));
document.getElementById('next-month').addEventListener('click', () => changeMonth(1));
document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => toggleFilter(btn.dataset.type));
});
document.getElementById('btn-edit-co').addEventListener('click', () => setEditMode('co'));
document.getElementById('btn-edit-cm').addEventListener('click', () => setEditMode('cm'));
document.getElementById('btn-apply-tura').addEventListener('click', () => setEditMode('tura'));
['pay-per-shift', 'double-multiplier'].forEach(id => {
  document.getElementById(id).addEventListener('change', () => {
    const payVal = document.getElementById('pay-per-shift').value;
    if (payVal.trim() === '') payPerShift = null; // câmp golit → necompletat
    applyDubleSettings(payVal, document.getElementById('double-multiplier').value);
    recalc(); saveSettings();
  });
});
document.getElementById('day-double-check').addEventListener('change', onDayDoubleToggle);
document.getElementById('day-double-ore').addEventListener('change', onDayDoubleOreChange);
document.getElementById('day-double-tip').addEventListener('change', onDayDoubleTipChange);
document.querySelectorAll('.ics-setting').forEach(el => {
  el.addEventListener('change', () => { readIcsInputs(); saveSettings(); if (isIcsPanelOpen()) prepareIcs(); });
});
document.getElementById('ics-range').addEventListener('change', () => { if (isIcsPanelOpen()) prepareIcs(); });
document.getElementById('day-modal-action').addEventListener('click', onDayPanelAction);
document.getElementById('day-modal').addEventListener('click', (e) => {
  if (e.target.id === 'day-modal') closeDayPanel();
});
document.getElementById('btn-clear-co').addEventListener('click', () => {
  if (coDays.size === 0 && cmDays.size === 0) return;
  if (!confirm('Ștergi toate zilele de CO și CM marcate?')) return;
  coDays.clear(); cmDays.clear();
  editMode = null; updateEditModeUI();
  recalc(); saveSettings();
});

// Custom ore input
document.addEventListener('DOMContentLoaded', () => {
  const oreInput = document.getElementById('custom-ore-input');
  if (oreInput) {
    oreInput.addEventListener('change', () => {
      recalc();
      saveSettings();
    });
  }
  const shiftStartInput = document.getElementById('shift-start-time');
  if (shiftStartInput) {
    shiftStartInput.addEventListener('change', () => saveSettings());
  }
});

// ===== PWA Install =====
let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  const wrap = document.getElementById('pwa-native-btn-wrap');
  if (wrap) wrap.style.display = 'block';
});

function openPwaModal() {
  const modal = document.getElementById('pwa-modal');
  if (!modal) return;
  modal.style.display = 'flex';
  const ua = navigator.userAgent || '';
  const isIOS = /iPad|iPhone|iPod/.test(ua) && !window.MSStream;
  const isAndroid = /Android/.test(ua);
  document.getElementById('pwa-ios').style.display = isIOS ? 'block' : 'none';
  document.getElementById('pwa-android').style.display = (!isIOS && isAndroid) ? 'block' : 'none';
  document.getElementById('pwa-desktop').style.display = (!isIOS && !isAndroid) ? 'block' : 'none';
}
function closePwaModal() {
  const modal = document.getElementById('pwa-modal');
  if (modal) modal.style.display = 'none';
}
function triggerNativeInstall() {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  deferredPrompt.userChoice.then((result) => {
    deferredPrompt = null;
    if (result.outcome === 'accepted') closePwaModal();
  });
}

// ===== Share =====
function openShareModal() {
  const modal = document.getElementById('share-modal');
  if (modal) modal.style.display = 'flex';
}
function closeShareModal() {
  const modal = document.getElementById('share-modal');
  if (modal) modal.style.display = 'none';
}
function shareWhatsApp() {
  const msg = encodeURIComponent('Bă, am găsit un calculator de ture mișto — calculează automat orele și suplimentarele 👇\nhttps://calculatorture.ro');
  window.open('https://wa.me/?text=' + msg, '_blank');
}
function shareFacebook() {
  window.open('https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent('https://calculatorture.ro'), '_blank');
}
function copyLink() {
  navigator.clipboard.writeText('https://calculatorture.ro').then(() => {
    const btn = document.getElementById('copy-btn-text');
    if (btn) {
      btn.textContent = '✓ Link copiat!';
      setTimeout(() => { btn.textContent = 'Copiază linkul (Instagram etc.)'; }, 2500);
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  const pwaModal = document.getElementById('pwa-modal');
  if (pwaModal) pwaModal.addEventListener('click', (e) => { if (e.target === pwaModal) closePwaModal(); });
  const shareModal = document.getElementById('share-modal');
  if (shareModal) shareModal.addEventListener('click', (e) => { if (e.target === shareModal) closeShareModal(); });
  const premiumModal = document.getElementById('premium-modal');
  if (premiumModal) premiumModal.addEventListener('click', (e) => { if (e.target === premiumModal) closePremiumModal(); });
  initPremiumBanner();
});

// ===== Premium Banner =====
const PREMIUM_BANNER_DISMISS_KEY = 'premium_banner_dismissed';
const PREMIUM_BANNER_DISMISS_MS = 7 * 24 * 60 * 60 * 1000; // 7 zile

function initPremiumBanner() {
  const banner = document.getElementById('premium-banner');
  if (!banner) return;
  const dismissedAt = parseInt(localStorage.getItem(PREMIUM_BANNER_DISMISS_KEY), 10);
  const stillDismissed = dismissedAt && (Date.now() - dismissedAt) < PREMIUM_BANNER_DISMISS_MS;
  banner.style.display = stillDismissed ? 'none' : 'flex';
}

function dismissPremiumBanner() {
  localStorage.setItem(PREMIUM_BANNER_DISMISS_KEY, Date.now().toString());
  const banner = document.getElementById('premium-banner');
  if (banner) banner.style.display = 'none';
}

function openPremiumModal() {
  if (typeof window.gtag === 'function') gtag('event', 'upgrade_click', { source: 'banner' });
  const modal = document.getElementById('premium-modal');
  if (modal) modal.style.display = 'flex';
}
function closePremiumModal() {
  const modal = document.getElementById('premium-modal');
  if (modal) modal.style.display = 'none';
}

// ===== Checkout Lemon Squeezy =====
function getGaClientId() {
  const match = document.cookie.match(/(?:^|;\s*)_ga=GA\d\.\d\.(\d+\.\d+)/);
  return match ? match[1] : null;
}

// Atașăm client_id-ul GA4 la link-ul de checkout ca custom data,
// ca să-l putem recupera în webhook-ul Lemon Squeezy și trimite
// evenimentul plata_confirmata (server-side) către același vizitator.
function startCheckout(el, plan) {
  if (typeof window.gtag === 'function') gtag('event', 'checkout_inceput', { plan: plan });
  const clientId = getGaClientId();
  if (clientId) {
    const url = new URL(el.href);
    url.searchParams.set('checkout[custom][client_id]', clientId);
    el.href = url.href;
  }
}

// ===== Notificări push (reminder înainte de tură, Premium) =====
function isIOSDevice() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
}

function isStandalonePWA() {
  return window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches;
}

function showPushStatus(msg, type) {
  const el = document.getElementById('push-status');
  if (!el) return;
  el.textContent = msg;
  el.className = 'push-status' + (type ? ' ' + type : '');
  el.style.display = 'block';
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

function updatePushSettingsUI() {
  const box = document.getElementById('push-settings');
  if (box) box.style.display = pushEligible ? 'block' : 'none';
}

async function activatePush() {
  if (!currentUser || !pushEligible) return;

  // iOS Safari suportă push doar din PWA instalată pe ecranul principal
  // (iOS 16.4+) — dintr-un tab normal, requestPermission eșuează silențios.
  if (isIOSDevice() && !isStandalonePWA()) {
    showPushStatus('Pe iPhone/iPad, notificările funcționează doar din aplicația instalată pe ecranul principal (iOS 16.4+). Instaleaz-o, apoi revino aici.', 'error');
    openPwaModal();
    return;
  }

  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    showPushStatus('Browserul tău nu suportă notificări push.', 'error');
    return;
  }

  const btn = document.getElementById('push-activate-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Se activează...'; }

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      showPushStatus('Ai refuzat notificările. Le poți activa oricând din setările browserului.', 'error');
      if (btn) { btn.disabled = false; btn.textContent = 'Activează notificări'; }
      return;
    }

    const reg = await navigator.serviceWorker.ready;

    const keyRes = await fetch('/api/vapid-public-key');
    if (!keyRes.ok) throw new Error('Nu am putut obține cheia VAPID.');
    const { publicKey } = await keyRes.json();

    const subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });

    const raw = subscription.toJSON();
    const { error } = await sb.from('push_subscriptions').upsert({
      user_id:  currentUser.id,
      endpoint: raw.endpoint,
      p256dh:   raw.keys.p256dh,
      auth_key: raw.keys.auth,
    }, { onConflict: 'user_id,endpoint' });

    if (error) throw error;

    showPushStatus('✓ Notificări activate! Îți trimitem un reminder înainte de tură.', 'success');
    if (btn) btn.textContent = '✓ Notificări active';
  } catch (err) {
    console.error('Eroare activare push:', err);
    showPushStatus('A apărut o eroare la activarea notificărilor. Încearcă din nou.', 'error');
    if (btn) { btn.disabled = false; btn.textContent = 'Activează notificări'; }
  }
}

// ===== Reset Parolă =====
function showResetPassword() {
  document.getElementById('auth-overlay').style.display = 'none';
  document.getElementById('reset-email').value = document.getElementById('auth-email').value || '';
  document.getElementById('reset-error').style.display = 'none';
  document.getElementById('reset-sub').textContent = 'Introdu emailul cu care te-ai înregistrat și îți trimitem un link de resetare.';
  document.getElementById('reset-overlay').style.display = 'flex';
}

function closeResetPassword() {
  document.getElementById('reset-overlay').style.display = 'none';
  document.getElementById('auth-overlay').style.display = 'flex';
}

async function doResetPassword() {
  const email = document.getElementById('reset-email').value.trim();
  const errEl = document.getElementById('reset-error');
  errEl.style.display = 'none';

  if (!email || !email.includes('@')) {
    errEl.textContent = 'Te rog introdu un email valid.';
    errEl.style.display = 'block';
    return;
  }

  const { error } = await sb.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin + window.location.pathname,
  });

  if (error) {
    errEl.textContent = 'Eroare la trimitere. Încearcă din nou.';
    errEl.style.display = 'block';
    return;
  }

  // Succes
  document.getElementById('reset-sub').textContent = '✅ Email trimis! Verifică inbox-ul (și folderul Spam). Linkul e valabil 1 oră.';
  document.getElementById('reset-email').style.display = 'none';
  document.querySelector('#reset-overlay .auth-btn:not(.ghost)').style.display = 'none';
}


function openAuth() {
  closeDropdown();
  document.getElementById('auth-overlay').style.display = 'flex';
}

function closeAuth() {
  document.getElementById('auth-overlay').style.display = 'none';
}

function showAuthError(msg) {
  const el = document.getElementById('auth-error');
  el.textContent = msg;
  el.style.display = 'block';
}

async function doLogin() {
  const email = document.getElementById('auth-email').value.trim();
  const pass  = document.getElementById('auth-pass').value;
  const { error } = await sb.auth.signInWithPassword({ email, password: pass });
  if (error) { showAuthError('Email sau parolă greșită.'); return; }
  closeAuth();
}

async function doRegister() {
  const email = document.getElementById('auth-email').value.trim();
  const pass  = document.getElementById('auth-pass').value;
  if (pass.length < 6) { showAuthError('Parola trebuie să aibă minim 6 caractere.'); return; }
  const { error } = await sb.auth.signUp({ email, password: pass });
  if (error) { showAuthError('Eroare la creare cont. Încearcă din nou.'); return; }

  if (typeof window.gtag === 'function') gtag('event', 'cont_creat');

  document.getElementById('auth-box-inner').innerHTML = `
    <div style="text-align:center; padding: 0.5rem 0;">
      <div style="font-size: 48px; margin-bottom: 1rem;">👷</div>
      <h2 class="auth-title" style="margin-bottom: 0.75rem;">Ești oficial boss!</h2>
      <p class="auth-sub" style="margin-bottom: 1.25rem; line-height: 1.6;">
        Dacă folosești Calculator Ture, înseamnă că turele nu te controlează pe tine —
        <strong>tu le controlezi pe ele.</strong><br><br>
        Bun venit în echipă! 💪
      </p>
      <button class="auth-btn" onclick="closeAuth(); location.reload();">Hai la treabă!</button>
    </div>
  `;
}

async function doLogout() {
  closeDropdown();
  await sb.auth.signOut();
}

// ===== Dropdown =====
function toggleDropdown() {
  const dd = document.getElementById('user-dropdown');
  dd.style.display = dd.style.display === 'block' ? 'none' : 'block';
}

function closeDropdown() {
  document.getElementById('user-dropdown').style.display = 'none';
}

document.addEventListener('click', (e) => {
  const dd  = document.getElementById('user-dropdown');
  const btn = document.getElementById('login-btn');
  const modal = document.getElementById('pdf-modal');
  if (!dd.contains(e.target) && !btn.contains(e.target)) closeDropdown();
  if (modal && e.target === modal) closePdfModal();
});

// ===== Update UI după auth =====
function updateUserBar(user) {
  const btn     = document.getElementById('login-btn');
  const notice  = document.getElementById('nav-notice');
  const prevBtn = document.getElementById('prev-month');
  const nextBtn = document.getElementById('next-month');
  const ddName  = document.getElementById('dropdown-name');
  const ddEmail = document.getElementById('dropdown-email');

  if (user) {
    currentUser = user;
    const name = user.email.split('@')[0];
    btn.textContent = '👤 ' + name;
    btn.className   = 'user-btn logged-in';
    btn.onclick     = toggleDropdown;
    ddName.textContent  = name;
    ddEmail.textContent = user.email;
    notice.style.display  = 'none';
    prevBtn.disabled = false;
    nextBtn.disabled = false;
  } else {
    currentUser = null;
    btn.textContent = 'Intră în cont';
    btn.className   = 'user-btn';
    btn.onclick     = openAuth;
    notice.style.display  = 'none';
    prevBtn.disabled = false;
    nextBtn.disabled = false;
    pushEligible = false;
    updatePushSettingsUI();
    recalc();
  }
}

// ===== Auth State =====
// Supabase trimite SIGNED_IN/TOKEN_REFRESHED și la revenirea în aplicație;
// reîncărcăm din Supabase doar la schimbarea contului, ca să nu suprascriem starea.
let loadedUserId = null;
sb.auth.onAuthStateChange(async (event, session) => {
  const user = session?.user ?? null;
  if (!user && stateOwner !== 'anon') {
    // Ieșire din cont: luna revine la cea curentă
    viewYear  = today.getFullYear();
    viewMonth = today.getMonth();
    saveViewMonth();
  }
  switchStateOwner(user ? user.id : 'anon');
  updateUserBar(user);
  debugAuthLine = `auth: ${event} → ${user ? 'logat' : 'fără cont'}`; // TEMPORAR
  renderDebug();
  if (!user) { loadedUserId = null; return; }
  if (user.id === loadedUserId) return;
  loadedUserId = user.id;
  recalc(); // afișează imediat copia locală a contului
  await loadSettings();
  await checkPremiumStatus();
});

// ===== Premium status =====
async function checkPremiumStatus() {
  if (!currentUser) return;
  const { data, error } = await sb
    .from('premium_status')
    .select('is_premium, premium_expires, push_product_active')
    .eq('user_id', currentUser.id)
    .maybeSingle();
  if (error) return;

  const isActivePremium = !!(
    data &&
    data.is_premium &&
    data.premium_expires &&
    new Date(data.premium_expires) > new Date()
  );

  if (isActivePremium) {
    const banner = document.getElementById('premium-banner');
    if (banner) banner.style.display = 'none';
  }

  pushEligible = isActivePremium && !!(data && data.push_product_active);
  updatePushSettingsUI();
}

// ===== Init =====
// Detectează dacă utilizatorul vine dintr-un link de reset parolă
(function checkPasswordReset() {
  const hash = window.location.hash;
  if (hash.includes('type=recovery')) {
    // Supabase a pus sesiunea de recovery automat — afișăm form de parolă nouă
    setTimeout(() => showNewPasswordForm(), 300);
  }
})();

function showNewPasswordForm() {
  document.getElementById('auth-overlay').style.display = 'flex';
  document.getElementById('auth-box-inner').innerHTML = `
    <div style="font-size:36px; text-align:center; margin-bottom:0.5rem;">🔐</div>
    <h2 class="auth-title">Parolă nouă</h2>
    <p class="auth-sub">Alege o parolă nouă pentru contul tău.</p>
    <div id="newpass-error" class="auth-error" style="display:none"></div>
    <input type="password" id="new-pass-1" placeholder="Parolă nouă" class="auth-input" />
    <input type="password" id="new-pass-2" placeholder="Confirmă parola" class="auth-input" />
    <button class="auth-btn" onclick="doSetNewPassword()">Salvează parola nouă</button>
  `;
}

async function doSetNewPassword() {
  const p1 = document.getElementById('new-pass-1').value;
  const p2 = document.getElementById('new-pass-2').value;
  const errEl = document.getElementById('newpass-error');
  errEl.style.display = 'none';

  if (p1.length < 6) {
    errEl.textContent = 'Parola trebuie să aibă minim 6 caractere.';
    errEl.style.display = 'block';
    return;
  }
  if (p1 !== p2) {
    errEl.textContent = 'Parolele nu coincid.';
    errEl.style.display = 'block';
    return;
  }

  const { error } = await sb.auth.updateUser({ password: p1 });
  if (error) {
    errEl.textContent = 'Eroare la salvare. Încearcă din nou.';
    errEl.style.display = 'block';
    return;
  }

  document.getElementById('auth-box-inner').innerHTML = `
    <div style="text-align:center; padding: 0.5rem 0;">
      <div style="font-size:48px; margin-bottom:1rem;">✅</div>
      <h2 class="auth-title" style="margin-bottom:0.75rem;">Parolă salvată!</h2>
      <p class="auth-sub" style="margin-bottom:1.25rem;">Te-ai autentificat automat. Bine ai revenit!</p>
      <button class="auth-btn" onclick="closeAuth()">Hai la treabă!</button>
    </div>
  `;
  // Curăță hash-ul din URL
  history.replaceState(null, '', window.location.pathname);
}

// Restaurare imediată din copia locală, înainte de primul desen; Supabase sincronizează apoi
stateOwner = getStoredSessionUserId() || 'anon';
restoreLocalState(stateOwner);
restoreViewMonth();
updateTuraTypeUI();
recalc();
renderDebug(); // TEMPORAR
