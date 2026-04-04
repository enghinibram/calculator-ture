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

// Aplică tema salvată la încărcare
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

// ===== Utilitare =====
function dayDiff(a, b) {
  const ua = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const ub = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((ub - ua) / 86400000);
}

function getShift(dateObj) {
  if (!startDate) return null;
  const pat  = PATTERNS[document.getElementById('tura-type').value];
  const diff = dayDiff(startDate, dateObj);
  const idx  = ((diff % pat.length) + pat.length) % pat.length;
  return pat[idx];
}

function getHoliday(year, month, day) {
  const key = year + '-' + month + '-' + day;
  const h   = HOLIDAYS[key];
  if (!h || !filters[h.type]) return null;
  return h;
}

// ===== Supabase: salvare =====
async function saveSettings() {
  if (!currentUser) return;
  const turaType = document.getElementById('tura-type').value;
  const startStr = startDate
    ? `${startDate.getFullYear()}-${String(startDate.getMonth()+1).padStart(2,'0')}-${String(startDate.getDate()).padStart(2,'0')}`
    : null;
  await sb.from('user_settings').upsert({
    user_id: currentUser.id,
    start_date: startStr,
    tura_type: turaType,
  }, { onConflict: 'user_id' });
}

// ===== Supabase: încărcare =====
async function loadSettings() {
  if (!currentUser) return;
  const { data } = await sb
    .from('user_settings')
    .select('*')
    .eq('user_id', currentUser.id)
    .single();
  if (data) {
    if (data.tura_type) document.getElementById('tura-type').value = data.tura_type;
    if (data.start_date) {
      const parts = data.start_date.split('-');
      startDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
      document.getElementById('start-info').textContent =
        'Start tură de zi: ' +
        startDate.toLocaleDateString('ro-RO', { weekday: 'long', day: 'numeric', month: 'long' }) +
        ' · tiparul merge în ambele direcții';
    }
  }
  recalc();
}

// ===== Auth UI =====
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
  document.querySelector('.auth-box').innerHTML = `
    <h2 class="auth-title">✅ Cont creat!</h2>
    <p class="auth-sub">Verifică emailul pentru confirmare, după care loghează-te.</p>
    <button class="auth-btn" onclick="location.reload()">OK</button>
  `;
}

async function doLogout() {
  closeDropdown();
  await sb.auth.signOut();
}

// ===== Dropdown =====
function toggleDropdown() {
  const dd = document.getElementById('user-dropdown');
  const isVisible = dd.style.display === 'block';
  dd.style.display = isVisible ? 'none' : 'block';
}

function closeDropdown() {
  document.getElementById('user-dropdown').style.display = 'none';
}

// Închide dropdown la click în afara lui
document.addEventListener('click', (e) => {
  const dd  = document.getElementById('user-dropdown');
  const btn = document.getElementById('login-btn');
  if (!dd.contains(e.target) && !btn.contains(e.target)) {
    closeDropdown();
  }
});

// ===== Update UI după auth =====
function updateUserBar(user) {
  const btn    = document.getElementById('login-btn');
  const notice = document.getElementById('nav-notice');
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
    notice.style.display  = 'flex';
    prevBtn.disabled = true;
    nextBtn.disabled = true;
    recalc();
  }
}

// ===== Recalculare =====
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
    elExtra.textContent = (extra >= 0 ? '+' : '') + extra;
    elExtra.style.color = extra >= 0 ? '#1D9E75' : '#e53e3e';
  }

  renderCal();
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
    const isToday = dateObj.toDateString() === today.toDateString();
    const isStart = startDate && dateObj.toDateString() === startDate.toDateString();

    let cls = 'day';
    if (sh) cls += ' ' + sh.type; else cls += ' liber';
    if (isToday) cls += ' today';
    if (isStart) cls += ' start-sel';

    const badge   = sh && sh.label ? `<span class="shift-badge">${sh.label}</span>` : '';
    const holHtml = hol ? `<span class="hol-name hol-${hol.type}">${hol.name}</span>` : '';

    html += `<div class="${cls}" data-y="${year}" data-m="${month}" data-d="${d}">${d}${badge}${holHtml}</div>`;
  }

  document.getElementById('cal').innerHTML = html;
  document.getElementById('cal').querySelectorAll('.day:not(.empty)').forEach(el => {
    el.addEventListener('click', () => {
      setStart(parseInt(el.dataset.y), parseInt(el.dataset.m), parseInt(el.dataset.d));
    });
  });
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

// ===== Navigare luni =====
function changeMonth(dir) {
  if (!currentUser) return;
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

// ===== Event Listeners =====
document.getElementById('tura-type').addEventListener('change', () => { recalc(); saveSettings(); });
document.getElementById('prev-month').addEventListener('click', () => changeMonth(-1));
document.getElementById('next-month').addEventListener('click', () => changeMonth(1));
document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => toggleFilter(btn.dataset.type));
});

// ===== PWA Install =====
let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  document.getElementById('pwa-install-btn').style.display = 'block';
});

document.getElementById('pwa-install-btn').addEventListener('click', async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  if (outcome === 'accepted') document.getElementById('pwa-install-btn').style.display = 'none';
  deferredPrompt = null;
});

// ===== Auth State =====
sb.auth.onAuthStateChange(async (event, session) => {
  const user = session?.user ?? null;
  updateUserBar(user);
  if (user) await loadSettings();
});

// ===== Init =====
document.getElementById('prev-month').disabled = true;
document.getElementById('next-month').disabled = true;
document.getElementById('nav-notice').style.display = 'flex';
recalc();
