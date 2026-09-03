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

// ===== Supabase: salvare =====
async function saveSettings() {
  if (!currentUser) return;
  const turaType = document.getElementById('tura-type').value;
  const startStr = startDate
    ? `${startDate.getFullYear()}-${String(startDate.getMonth()+1).padStart(2,'0')}-${String(startDate.getDate()).padStart(2,'0')}`
    : null;
  const shiftStartInput = document.getElementById('shift-start-time');
  const shiftStartTime = shiftStartInput && shiftStartInput.value ? shiftStartInput.value : null;
  await sb.from('user_settings').upsert({
    user_id:          currentUser.id,
    start_date:       startStr,
    tura_type:        turaType,
    co_days:          serializeSet(coDays),
    cm_days:          serializeSet(cmDays),
    custom_days:      serializeSet(customDays),
    custom_ore:       getCustomOre(),
    shift_start_time: shiftStartTime,
  }, { onConflict: 'user_id' });
}

// ===== Supabase: încărcare =====
async function loadSettings() {
  if (!currentUser) return;
  const { data } = await sb
    .from('user_settings')
    .select('*')
    .eq('user_id', currentUser.id)
    .maybeSingle();
  if (data) {
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
    if (data.custom_ore) {
      const inp = document.getElementById('custom-ore-input');
      if (inp) inp.value = data.custom_ore;
    }
    if (data.shift_start_time) {
      const inp = document.getElementById('shift-start-time');
      if (inp) inp.value = data.shift_start_time.slice(0, 5); // "HH:MM:SS" -> "HH:MM"
    }
  }
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
  const hint  = document.getElementById('edit-hint');
  btnCo.classList.toggle('active-edit-co', editMode === 'co');
  btnCm.classList.toggle('active-edit-cm', editMode === 'cm');
  if (editMode === 'co') {
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

  // Custom mode: click = toggle zi lucrătoare
  if (isCustomMode()) {
    if (coDays.has(key) || cmDays.has(key)) return; // nu suprascrie CO/CM
    customDays.has(key) ? customDays.delete(key) : customDays.add(key);
    recalc(); saveSettings(); return;
  }

  // Click normal → setare start tură
  setStart(y, m, d);
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
    startInfo.textContent = '👆 Bifează zilele în care lucrezi apăsând pe ele în calendar.';
  } else {
    customPanel.style.display = 'none';
    if (!startDate) {
      startInfo.textContent = 'Apasă pe o zi de tură de ZI pentru a seta tiparul.';
    }
  }
}

// ===== Recalculare =====
function recalc() {
  const year  = viewYear;
  const month = viewMonth;
  const days  = new Date(year, month + 1, 0).getDate();
  const oreZi = getOrePerZi();
  let oreLucrate = 0;
  let oreCoLuna  = 0;
  let oreCmLuna  = 0;

  for (let d = 1; d <= days; d++) {
    const dateObj = new Date(year, month, d);
    const sh  = getShift(dateObj);
    const key = dayKey(year, month + 1, d);

    if (coDays.has(key)) {
      oreCoLuna += 8;
    } else if (cmDays.has(key)) {
      oreCmLuna += 8;
    } else if (sh && (sh.type === 'zi' || sh.type === 'noapte')) {
      oreLucrate += oreZi;
    }
  }

  const totalPontat = oreLucrate + oreCoLuna + oreCmLuna;
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
    }
  }

  updateCoBadge();
  renderCal();
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

    let cls = 'day';
    if (isCo)       cls += ' co';
    else if (isCm)  cls += ' cm';
    else if (sh)    cls += ' ' + sh.type;
    else            cls += ' liber';

    if (isToday) cls += ' today';
    if (isStart) cls += ' start-sel';
    if (legal)   cls += ' legal-holiday';

    // În mod custom, zilele lucrătoare au cursor diferit
    if (isCustomMode() && !isCo && !isCm) cls += ' custom-clickable';

    const badge    = (!isCo && !isCm && sh && sh.label) ? `<span class="shift-badge">${sh.label}</span>` : '';
    const coBadge  = isCo ? `<span class="hol-name hol-co">CO</span>` : '';
    const cmBadge  = isCm ? `<span class="hol-name hol-cm">CM</span>` : '';
    const legalBdg = legal ? `<span class="hol-name hol-legal" title="${legal}">ZL</span>` : '';
    const holHtml  = hol   ? `<span class="hol-name hol-${hol.type}">${hol.name}</span>` : '';

    html += `<div class="${cls}" data-y="${year}" data-m="${month}" data-d="${d}">${d}${badge}${coBadge}${cmBadge}${legalBdg}${holHtml}</div>`;
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

// ===== Event Listeners =====
document.getElementById('tura-type').addEventListener('change', () => {
  updateTuraTypeUI();
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
    viewYear  = today.getFullYear();
    viewMonth = today.getMonth();
    notice.style.display  = 'none';
    prevBtn.disabled = false;
    nextBtn.disabled = false;
    pushEligible = false;
    updatePushSettingsUI();
    recalc();
  }
}

// ===== Auth State =====
sb.auth.onAuthStateChange(async (event, session) => {
  const user = session?.user ?? null;
  updateUserBar(user);
  if (user) {
    await loadSettings();
    await checkPremiumStatus();
  }
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

updateTuraTypeUI();
recalc();
