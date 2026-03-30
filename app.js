// ===== State =====
const today = new Date();
let viewYear  = today.getFullYear();
let viewMonth = today.getMonth();
let startDate = null;
let filters   = { ort: true, iud: true, isl: true };

// ===== Norme oficiale ore/lună =====
const NORMA = {
  2025: [168, 160, 168, 168, 160, 168, 184, 168, 176, 184, 160, 160],
  2026: [144, 160, 176, 160, 160, 168, 184, 168, 176, 176, 160, 168],
};

function getNorma(year, month) {
  if (NORMA[year]) return NORMA[year][month];
  // fallback: calcul dinamic dacă anul nu e în tabel
  let wd = 0;
  const days = new Date(year, month + 1, 0).getDate();
  for (let d = 1; d <= days; d++) {
    const dow = new Date(year, month, d).getDay();
    if (dow !== 0 && dow !== 6) wd++;
  }
  return wd * 8;
}

// ===== Tipare de tură =====
// Fiecare element = o zi din ciclu
// 12/24-12/48: Z(1zi) → N(1zi) → L(1zi) → L(1zi) → ciclu de 4
const PATTERNS = {
  '12/24-12/48': [
    { type: 'zi',     label: 'Z' },
    { type: 'noapte', label: 'N' },
    { type: 'liber',  label: '' },
    { type: 'liber',  label: '' },
  ],
  '12/24': [
    { type: 'zi',     label: 'Z' },
    { type: 'liber',  label: '' },
    { type: 'noapte', label: 'N' },
    { type: 'liber',  label: '' },
  ],
  '12/24-24/72': [
    { type: 'zi',     label: 'Z' },
    { type: 'noapte', label: 'N' },
    { type: 'liber',  label: '' },
    { type: 'liber',  label: '' },
    { type: 'liber',  label: '' },
    { type: 'liber',  label: '' },
  ],
};

// ===== Sărbători 2026 =====
// Cheia: "an-luna-zi" (luna fără zero: 1=ianuarie)
// type: 'ort' = ortodox, 'iud' = iudaic, 'isl' = islamic
const HOLIDAYS = {
  '2026-1-1':  { name: 'Anul Nou',        type: 'ort' },
  '2026-1-6':  { name: 'Boboteaza',       type: 'ort' },
  '2026-1-7':  { name: 'Sf. Ioan',        type: 'ort' },
  '2026-1-24': { name: 'Unirea',          type: 'ort' },
  '2026-2-2':  { name: 'Tu Bishvat',      type: 'iud' },
  '2026-2-24': { name: 'Dragobete',       type: 'ort' },
  '2026-3-2':  { name: 'Postul Esterei',  type: 'iud' },
  '2026-3-3':  { name: 'Purim',           type: 'iud' },
  '2026-3-8':  { name: '8 Martie',        type: 'ort' },
  '2026-3-19': { name: 'Eid al-Fitr',     type: 'isl' },
  '2026-3-20': { name: 'Eid al-Fitr',     type: 'isl' },
  '2026-4-1':  { name: 'Pesach',          type: 'iud' },
  '2026-4-2':  { name: 'Pesach',          type: 'iud' },
  '2026-4-3':  { name: 'Pesach',          type: 'iud' },
  '2026-4-4':  { name: 'Pesach',          type: 'iud' },
  '2026-4-5':  { name: 'Floriile',        type: 'ort' },
  '2026-4-7':  { name: 'Pesach',          type: 'iud' },
  '2026-4-8':  { name: 'Pesach',          type: 'iud' },
  '2026-4-10': { name: 'Vinerea Mare',    type: 'ort' },
  '2026-4-11': { name: 'Sâmbăta Mare',   type: 'ort' },
  '2026-4-12': { name: 'Paștele',         type: 'ort' },
  '2026-4-13': { name: 'Paștele',         type: 'ort' },
  '2026-5-1':  { name: 'Ziua Muncii',     type: 'ort' },
  '2026-5-21': { name: 'Înălțarea',       type: 'ort' },
  '2026-5-22': { name: 'Shavuot',         type: 'iud' },
  '2026-5-26': { name: 'Ziua Arafah',     type: 'isl' },
  '2026-5-27': { name: 'Eid al-Adha',     type: 'isl' },
  '2026-5-28': { name: 'Eid al-Adha',     type: 'isl' },
  '2026-5-31': { name: 'Rusaliile',       type: 'ort' },
  '2026-6-1':  { name: 'Rusaliile',       type: 'ort' },
  '2026-6-16': { name: 'An Nou Islamic',  type: 'isl' },
  '2026-6-25': { name: 'Ashura',          type: 'isl' },
  '2026-7-29': { name: "Tisha B'Av",      type: 'iud' },
  '2026-8-15': { name: 'Sf. Maria',       type: 'ort' },
  '2026-8-25': { name: 'Mawlid al-Nabi',  type: 'isl' },
  '2026-9-11': { name: 'Rosh Hashana',    type: 'iud' },
  '2026-9-12': { name: 'Rosh Hashana',    type: 'iud' },
  '2026-9-20': { name: 'Yom Kippur',      type: 'iud' },
  '2026-9-25': { name: 'Sukkot',          type: 'iud' },
  '2026-10-1': { name: 'Simhat Torah',    type: 'iud' },
  '2026-11-30':{ name: 'Sf. Andrei',      type: 'ort' },
  '2026-12-1': { name: 'Ziua Națională',  type: 'ort' },
  '2026-12-15':{ name: 'Chanukah',        type: 'iud' },
  '2026-12-16':{ name: 'Chanukah',        type: 'iud' },
  '2026-12-17':{ name: 'Chanukah',        type: 'iud' },
  '2026-12-18':{ name: 'Chanukah',        type: 'iud' },
  '2026-12-19':{ name: 'Chanukah',        type: 'iud' },
  '2026-12-20':{ name: 'Chanukah',        type: 'iud' },
  '2026-12-21':{ name: 'Chanukah',        type: 'iud' },
  '2026-12-22':{ name: 'Chanukah',        type: 'iud' },
  '2026-12-25':{ name: 'Crăciunul',       type: 'ort' },
  '2026-12-26':{ name: 'Crăciunul',       type: 'ort' },
};

// ===== Funcții utilitare =====

// Diferența în zile între două date (b - a)
function dayDiff(a, b) {
  const ua = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const ub = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((ub - ua) / 86400000);
}

// Returnează tipul de tură pentru o zi dată
function getShift(dateObj) {
  if (!startDate) return null;
  const pat  = PATTERNS[document.getElementById('tura-type').value];
  const diff = dayDiff(startDate, dateObj);
  const idx  = ((diff % pat.length) + pat.length) % pat.length;
  return pat[idx];
}

// Returnează sărbătoarea pentru o zi dată (dacă filtrul e activ)
function getHoliday(year, month, day) {
  const key = year + '-' + month + '-' + day;
  const h   = HOLIDAYS[key];
  if (!h || !filters[h.type]) return null;
  return h;
}

// ===== Recalculare ore și render =====
function recalc() {
  const year  = viewYear;
  const month = viewMonth;
  const days  = new Date(year, month + 1, 0).getDate();
  let oreLucrate = 0;

  for (let d = 1; d <= days; d++) {
    const sh = getShift(new Date(year, month, d));
    if (sh && (sh.type === 'zi' || sh.type === 'noapte')) oreLucrate += 12;
  }

  const norma = getNorma(year, month);
  const extra = oreLucrate - norma;

  if (startDate) {
    document.getElementById('ore-lucrate').textContent = oreLucrate;
    document.getElementById('norma').textContent       = norma;
    const elExtra = document.getElementById('ore-extra');
    elExtra.textContent  = (extra >= 0 ? '+' : '') + extra;
    elExtra.style.color  = extra >= 0 ? '#0F6E56' : '#A32D2D';
  }

  renderCal();
}

// ===== Render calendar =====
function renderCal() {
  const year  = viewYear;
  const month = viewMonth;

  // Titlu luna
  const lbl = new Date(year, month, 1).toLocaleDateString('ro-RO', {
    month: 'long', year: 'numeric'
  });
  document.getElementById('month-label').textContent =
    lbl.charAt(0).toUpperCase() + lbl.slice(1);

  // Offset prima zi (luni = 0)
  const firstDay = new Date(year, month, 1).getDay();
  const offset   = firstDay === 0 ? 6 : firstDay - 1;
  const days     = new Date(year, month + 1, 0).getDate();
  const names    = ['Lu', 'Ma', 'Mi', 'Jo', 'Vi', 'Sâ', 'Du'];

  let html = names.map(n => `<div class="cal-day-name">${n}</div>`).join('');

  // Celule goale la început
  for (let i = 0; i < offset; i++) html += '<div class="day empty"></div>';

  // Zilele lunii
  for (let d = 1; d <= days; d++) {
    const dateObj = new Date(year, month, d);
    const sh      = getShift(dateObj);
    const hol     = getHoliday(year, month + 1, d);
    const isToday = dateObj.toDateString() === today.toDateString();
    const isStart = startDate && dateObj.toDateString() === startDate.toDateString();

    let cls = 'day';
    if (sh) cls += ' ' + sh.type;
    else    cls += ' liber';
    if (isToday) cls += ' today';
    if (isStart) cls += ' start-sel';

    const badge  = sh && sh.label
      ? `<span class="shift-badge">${sh.label}</span>`
      : '';
    const holHtml = hol
      ? `<span class="hol-name hol-${hol.type}">${hol.name}</span>`
      : '';

    html += `<div class="${cls}" data-y="${year}" data-m="${month}" data-d="${d}">${d}${badge}${holHtml}</div>`;
  }

  document.getElementById('cal').innerHTML = html;

  // Event listeners pe zile (delegare pe grid)
  document.getElementById('cal').querySelectorAll('.day:not(.empty)').forEach(el => {
    el.addEventListener('click', () => {
      const y = parseInt(el.dataset.y);
      const m = parseInt(el.dataset.m);
      const d = parseInt(el.dataset.d);
      setStart(y, m, d);
    });
  });
}

// ===== Setare zi de start =====
function setStart(y, m, d) {
  startDate = new Date(y, m, d);
  document.getElementById('start-info').textContent =
    'Start tură de zi: ' +
    startDate.toLocaleDateString('ro-RO', {
      weekday: 'long', day: 'numeric', month: 'long'
    }) +
    ' · tiparul merge în ambele direcții';
  recalc();
}

// ===== Navigare luni =====
function changeMonth(dir) {
  viewMonth += dir;
  if (viewMonth > 11) { viewMonth = 0; viewYear++; }
  if (viewMonth < 0)  { viewMonth = 11; viewYear--; }
  recalc();
}

// ===== Toggle filtre sărbători =====
function toggleFilter(type) {
  filters[type] = !filters[type];
  const btn = document.getElementById('btn-' + type);
  btn.className = filters[type]
    ? 'filter-btn active-' + type
    : 'filter-btn';
  recalc();
}

// ===== Event Listeners =====
document.getElementById('tura-type').addEventListener('change', recalc);
document.getElementById('prev-month').addEventListener('click', () => changeMonth(-1));
document.getElementById('next-month').addEventListener('click', () => changeMonth(1));

document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => toggleFilter(btn.dataset.type));
});

// ===== Init =====
recalc();