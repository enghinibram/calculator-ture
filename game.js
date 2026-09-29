// =====================================================================
// MINI-JOC OPȚIONAL (invitație discretă + „prinde bulina”, 30 de secunde)
// Fișier separat de app.js: o eroare aici nu poate opri pornirea aplicației.
// Totul se ține local, în cheia ture-game; fără cont, fără Supabase.
// =====================================================================
(function () {
  const GAME_KEY = 'ture-game';
  const INVITE_TEXTS = ['Ai chef de-un joc?', 'Ai 30 de secunde să arzi gazul degeaba? Hai la un joc'];
  const MIN_OPENS         = 3;                    // cel puțin a treia deschidere
  const IDLE_MS           = 6000;                 // ~6 s fără atingere
  const INVITE_TIMEOUT_MS = 10000;                // bula dispare singură
  const SNOOZE_MS         = 3 * 24 * 3600 * 1000; // „Nu” = pauză de 3 zile
  const MAX_DECLINES      = 3;                    // după 3 refuzuri la rând → oprit
  const GAME_MS           = 30000;

  const $ = id => document.getElementById(id);

  // ---------- Date locale ----------
  function loadGame() {
    const d = { opens: 0, lastInviteDate: null, snoozeUntil: 0, declines: 0, invitesOff: false, best: 0 };
    try { return Object.assign(d, JSON.parse(localStorage.getItem(GAME_KEY)) || {}); }
    catch { return d; }
  }
  function saveGame(g) {
    try { localStorage.setItem(GAME_KEY, JSON.stringify(g)); } catch { /* storage indisponibil */ }
  }
  function todayStr() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  function ga(name, params) {
    if (typeof window.gtag === 'function') gtag('event', name, params);
  }
  const reducedMotion = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------- Condiții de apariție ----------
  function isShown(el) { return !!el && getComputedStyle(el).display !== 'none'; }

  // Niciun panou, fereastră, secțiune de setări, mod de editare sau tastatură
  function nothingOpen() {
    if (typeof editMode !== 'undefined' && editMode) return false;
    const ids = ['day-modal', 'salary-panel', 'sal-panel-setari', 'sal-panel-detalii', 'ics-panel',
      'auth-overlay', 'reset-overlay', 'pdf-modal', 'premium-modal', 'share-modal', 'pwa-modal',
      'email-capture-card', 'cookie-banner', 'user-dropdown', 'game-layer'];
    if (ids.some(id => isShown($(id)))) return false;
    const a = document.activeElement;
    if (a && (a.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName))) return false;
    return true;
  }

  function canInviteToday(g) {
    return !g.invitesOff && g.opens >= MIN_OPENS && g.lastInviteDate !== todayStr() && Date.now() >= g.snoozeUntil;
  }

  // ---------- Invitația ----------
  let lastInteraction = Date.now();
  let inviteTimer = null;
  let checkTimer = null;
  let guardTimer = null;

  ['pointerdown', 'touchstart', 'keydown', 'wheel'].forEach(ev =>
    document.addEventListener(ev, () => { lastInteraction = Date.now(); }, { passive: true, capture: true }));

  function startInviteWatch() {
    clearInterval(checkTimer);
    if (!canInviteToday(loadGame())) return;
    checkTimer = setInterval(() => {
      const g = loadGame();
      if (!canInviteToday(g)) { clearInterval(checkTimer); return; }
      if (document.visibilityState !== 'visible') return;
      if (Date.now() - lastInteraction < IDLE_MS) return;
      if (!nothingOpen()) return;
      clearInterval(checkTimer);
      showInvite(g);
    }, 1000);
  }

  function showInvite(g) {
    g.lastInviteDate = todayStr(); // contează ca invitația de azi, chiar fără răspuns
    saveGame(g);
    $('game-invite-text').textContent = INVITE_TEXTS[Math.floor(Math.random() * INVITE_TEXTS.length)];
    $('game-invite').style.display = 'flex';
    ga('game_invite_shown');
    clearTimeout(inviteTimer);
    inviteTimer = setTimeout(hideInvite, INVITE_TIMEOUT_MS); // fără răspuns ≠ refuz
    // Dacă se deschide un panou sau tastatura cât e afișată, bula dispare (nu e refuz)
    clearInterval(guardTimer);
    guardTimer = setInterval(() => { if (!nothingOpen()) hideInvite(); }, 300);
  }

  function hideInvite() {
    clearTimeout(inviteTimer);
    clearInterval(guardTimer);
    $('game-invite').style.display = 'none';
  }

  $('game-invite-yes').addEventListener('click', () => {
    const g = loadGame();
    g.declines = 0;
    saveGame(g);
    hideInvite();
    ga('game_invite_yes');
    openGame();
  });

  $('game-invite-no').addEventListener('click', () => {
    const g = loadGame();
    g.declines += 1;
    g.snoozeUntil = Date.now() + SNOOZE_MS;
    if (g.declines >= MAX_DECLINES) g.invitesOff = true;
    saveGame(g);
    hideInvite();
    syncSettings();
    ga('game_invite_no');
  });

  // ---------- Setări ----------
  function syncSettings() {
    const t = $('game-invites-toggle');
    if (t) t.checked = !loadGame().invitesOff;
  }

  $('game-invites-toggle').addEventListener('change', (e) => {
    const g = loadGame();
    g.invitesOff = !e.target.checked;
    if (e.target.checked) { g.declines = 0; g.snoozeUntil = 0; } // repornire curată
    saveGame(g);
    if (e.target.checked) startInviteWatch();
  });

  $('btn-game-play').addEventListener('click', () => openGame()); // direct, fără limite

  // ---------- Jocul ----------
  const arena = $('game-arena');
  const dot   = $('game-dot');
  const st = { running: false, level: 1, catches: 0, x: 0, y: 0, vx: 0, vy: 0, size: 64,
               endAt: 0, pausedLeft: 0, last: 0, raf: 0 };

  function dotSize(level) {
    // Nivelurile 1–3: 64px; apoi se micșorează cu 5px/nivel, minim 34px
    return Math.max(34, 64 - Math.max(0, level - 3) * 5);
  }
  function dotSpeed(level) {
    const s = Math.min(900, 90 * Math.pow(1.2, level - 1)); // px/s
    return reducedMotion() ? s * 0.6 : s;
  }

  function aimRandom() {
    const ang = Math.random() * Math.PI * 2;
    const sp = dotSpeed(st.level);
    st.vx = Math.cos(ang) * sp;
    st.vy = Math.sin(ang) * sp;
  }

  function placeDot(randomPos) {
    st.size = dotSize(st.level);
    dot.style.width = dot.style.height = st.size + 'px';
    const W = arena.clientWidth, H = arena.clientHeight;
    if (randomPos) {
      st.x = Math.random() * Math.max(0, W - st.size);
      st.y = Math.random() * Math.max(0, H - st.size);
    }
    st.x = Math.min(Math.max(0, st.x), Math.max(0, W - st.size));
    st.y = Math.min(Math.max(0, st.y), Math.max(0, H - st.size));
    dot.style.transform = `translate(${st.x}px, ${st.y}px)`;
  }

  function renderHud() {
    $('game-level').textContent   = st.level;
    $('game-catches').textContent = st.catches;
    $('game-time').textContent    = Math.max(0, Math.ceil((st.endAt - performance.now()) / 1000));
  }

  function tick(now) {
    if (!st.running) return;
    const dt = Math.min(0.05, (now - st.last) / 1000); // max 50 ms/pas (după pauze)
    st.last = now;
    const W = arena.clientWidth, H = arena.clientHeight;
    st.x += st.vx * dt;
    st.y += st.vy * dt;
    if (st.x <= 0)            { st.x = 0;            st.vx =  Math.abs(st.vx); }
    if (st.x >= W - st.size)  { st.x = W - st.size;  st.vx = -Math.abs(st.vx); }
    if (st.y <= 0)            { st.y = 0;            st.vy =  Math.abs(st.vy); }
    if (st.y >= H - st.size)  { st.y = H - st.size;  st.vy = -Math.abs(st.vy); }
    dot.style.transform = `translate(${st.x}px, ${st.y}px)`;
    renderHud();
    if (now >= st.endAt) { finishGame(); return; }
    st.raf = requestAnimationFrame(tick);
  }

  function onCatch(e) {
    e.preventDefault();
    e.stopPropagation();
    if (!st.running) return;
    st.catches += 1;
    st.level += 1;
    $('game-hint').style.display = 'none';
    try { if (navigator.vibrate) navigator.vibrate(30); } catch { /* fără vibrație */ }
    if (!reducedMotion()) {
      dot.classList.remove('caught');
      void dot.offsetWidth; // repornește animația
      dot.classList.add('caught');
    }
    placeDot(true);
    aimRandom();
    renderHud();
  }
  dot.addEventListener('pointerdown', onCatch);

  // Fără derulare / „trage ca să reîmprospătezi” pe stratul jocului
  $('game-layer').addEventListener('touchmove', e => e.preventDefault(), { passive: false });

  function openGame() {
    hideInvite();
    const layer = $('game-layer');
    layer.style.display = 'flex';
    $('game-result').style.display = 'none';
    document.body.style.overflow = 'hidden';
    document.body.classList.add('game-open');
    st.level = 1; st.catches = 0; st.running = true;
    $('game-hint').style.display = '';
    requestAnimationFrame(() => {       // după layout, ca arena să aibă dimensiuni
      placeDot(true);
      aimRandom();
      st.endAt = performance.now() + GAME_MS;
      st.last = performance.now();
      renderHud();
      st.raf = requestAnimationFrame(tick);
    });
  }

  function stopLoop() {
    st.running = false;
    cancelAnimationFrame(st.raf);
  }

  function finishGame() {
    stopLoop();
    const g = loadGame();
    if (st.catches > g.best) g.best = st.catches;
    saveGame(g);
    $('game-res-level').textContent   = st.level;
    $('game-res-catches').textContent = st.catches;
    $('game-res-best').textContent    = g.best;
    $('game-result').style.display = 'flex';
    ga('game_finished', { level: st.level });
  }

  function closeGame() {
    stopLoop();
    $('game-layer').style.display = 'none';
    document.body.style.overflow = '';
    document.body.classList.remove('game-open');
  }

  $('game-exit').addEventListener('click', closeGame);
  $('game-close').addEventListener('click', closeGame);

  // Aplicația în fundal: jocul se oprește pe loc și continuă de unde a rămas
  document.addEventListener('visibilitychange', () => {
    if ($('game-layer').style.display === 'none' || $('game-result').style.display !== 'none') return;
    if (document.visibilityState === 'hidden' && st.running) {
      st.pausedLeft = st.endAt - performance.now();
      stopLoop();
    } else if (document.visibilityState === 'visible' && !st.running) {
      st.running = true;
      st.endAt = performance.now() + st.pausedLeft;
      st.last = performance.now();
      st.raf = requestAnimationFrame(tick);
    }
  });

  // ---------- Pornire ----------
  const g = loadGame();
  g.opens += 1; // o deschidere = o încărcare a aplicației
  saveGame(g);
  syncSettings();
  startInviteWatch();
})();
