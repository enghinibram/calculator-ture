// ===== Configurație pe an: sărbători legale, sărbători religioase, norme, taxe =====
// Folosit de index.html (app.js) și calculator-salariu.html.
//
// Pentru un an nou (ex. 2028) adaugi O SINGURĂ intrare în YEAR_CONFIG:
//   - orthodoxEaster: data Paștelui ortodox [lună, zi], verificată din sursă oficială
//     (la încărcare se compară cu algoritmul Meeus; nepotrivirea apare în consolă)
//   - religious: zilele iudaice / islamice (datele ortodoxe se calculează din Paște);
//     islApprox: true marchează datele islamice ca estimate (afișate cu ≈ în calendar)
//   - salary: valorile fiscale ale anului, cu salariul minim pe perioade (null = neconfirmate
//     oficial → calculatorul de salariu nu calculează pentru acel an; nu se folosesc valorile
//     altui an). Formula de calcul e în salary-calc.js.
// Zilele libere legale fixe (art. 139 Codul muncii) sunt în LEGAL_FIXED, iar cele
// legate de Paște în LEGAL_FROM_EASTER — nu se repetă pe fiecare an.
// Norma lunii se calculează din aceste date: zile lucrătoare (L–V) minus zilele
// libere legale care cad în L–V, × 8 ore. Sărbătorile din weekend nu se recuperează
// (Codul muncii nu prevede zi liberă compensatorie).

// Art. 139 alin. (1) Codul muncii (Legea 53/2003), inclusiv 6 și 7 ianuarie (Legea 52/2023)
const LEGAL_FIXED = [
  [1, 1,   'Anul Nou'],
  [1, 2,   'Anul Nou'],
  [1, 6,   'Boboteaza'],
  [1, 7,   'Sf. Ioan'],
  [1, 24,  'Unirea Principatelor'],
  [5, 1,   'Ziua Muncii'],
  [6, 1,   'Ziua Copilului'],
  [8, 15,  'Sf. Maria'],
  [11, 30, 'Sf. Andrei'],
  [12, 1,  'Ziua Națională'],
  [12, 25, 'Crăciunul'],
  [12, 26, 'Crăciunul'],
];

// Zile libere legale relative la Paștele ortodox (în zile)
const LEGAL_FROM_EASTER = [
  [-2, 'Vinerea Mare'],
  [0,  'Paștele'],
  [1,  'Paștele'],
  [49, 'Rusaliile'],
  [50, 'Rusaliile'],
];

// Sărbători ortodoxe/culturale afișate în calendar (nu sunt zile libere în plus)
const ORT_FIXED = [
  [1, 6,  'Boboteaza'],
  [1, 7,  'Sf. Ioan'],
  [2, 24, 'Dragobete'],
  [3, 8,  '8 Martie'],
];
const ORT_FROM_EASTER = [
  [-7, 'Floriile'],
  [-1, 'Sâmbăta Mare'],
  [39, 'Înălțarea'],
];

const YEAR_CONFIG = {
  2025: {
    orthodoxEaster: [4, 20],
    religious: { iud: [], isl: [] }, // nu au existat date iudaice/islamice pentru 2025
    salary: null,
  },

  2026: {
    orthodoxEaster: [4, 12],
    religious: {
      // Sursa: hebcal.com (diaspora), ziua sărbătorii propriu-zise (nu seara de început)
      iud: [
        [2, 2, 'Tu Bishvat'], [3, 2, 'Postul Esterei'], [3, 3, 'Purim'],
        [4, 2, 'Pesach'], [4, 3, 'Pesach'], [4, 8, 'Pesach'], [4, 9, 'Pesach'],
        [5, 22, 'Shavuot'], [7, 23, "Tisha B'Av"],
        [9, 12, 'Rosh Hashana'], [9, 13, 'Rosh Hashana'], [9, 21, 'Yom Kippur'],
        [9, 26, 'Sukkot'], [10, 4, 'Simhat Torah'],
        [12, 5, 'Chanukah'], [12, 6, 'Chanukah'], [12, 7, 'Chanukah'], [12, 8, 'Chanukah'],
        [12, 9, 'Chanukah'], [12, 10, 'Chanukah'], [12, 11, 'Chanukah'], [12, 12, 'Chanukah'],
      ],
      isl: [
        [3, 19, 'Eid al-Fitr'], [3, 20, 'Eid al-Fitr'], [5, 26, 'Ziua Arafah'],
        [5, 27, 'Eid al-Adha'], [5, 28, 'Eid al-Adha'], [6, 16, 'An Nou Islamic'],
        [6, 25, 'Ashura'], [8, 25, 'Mawlid al-Nabi'],
      ],
    },
    salary: {
      cas: 0.25, cass: 0.10, impozit: 0.10,
      // Salariul minim se schimbă în cursul anului → valori pe perioade (luna de început, 1–12).
      //   salariuMinim:     4.050 lei, apoi 4.325 lei din 1 iulie (HG 146/2026).
      //   actNormativ:      afișat utilizatorului lângă salariul minim, în rezultat.
      // Pentru dezvoltatori: valorile salariului minim vin din surse secundare (presă, site-uri de
      // contabilitate); textul oficial al HG 146/2026 nu a fost citit.
      // Regulile deducerii (salary-calc.js) sunt verificate în Codul fiscal consolidat ANAF, art. 77.
      // Suma netaxabilă pentru salariul minim NU e inclusă (neverificată în sursa oficială).
      perioade: [
        { dinLuna: 1, salariuMinim: 4050 },
        { dinLuna: 7, salariuMinim: 4325, actNormativ: 'HG 146/2026' },
      ],
    },
  },

  2027: {
    // Paștele ortodox 2 mai 2027 (calculat + confirmat în presă; Vinerea Mare 30 apr, Rusalii 20–21 iun)
    orthodoxEaster: [5, 2],
    religious: {
      // Sursa: hebcal.com (diaspora), ziua sărbătorii propriu-zise (nu seara de început)
      iud: [
        [1, 23, 'Tu Bishvat'], [3, 22, 'Postul Esterei'], [3, 23, 'Purim'],
        [4, 22, 'Pesach'], [4, 23, 'Pesach'], [4, 28, 'Pesach'], [4, 29, 'Pesach'],
        [6, 11, 'Shavuot'], [8, 12, "Tisha B'Av"],
        [10, 2, 'Rosh Hashana'], [10, 3, 'Rosh Hashana'], [10, 11, 'Yom Kippur'],
        [10, 16, 'Sukkot'], [10, 24, 'Simhat Torah'],
        [12, 25, 'Chanukah'], [12, 26, 'Chanukah'], [12, 27, 'Chanukah'], [12, 28, 'Chanukah'],
        [12, 29, 'Chanukah'], [12, 30, 'Chanukah'], [12, 31, 'Chanukah'], // continuă 1 ian 2028
      ],
      // Sursa: islamicfinder.org — date ESTIMATE, depind de observarea lunii (±1 zi).
      // Ziua Arafah, Ashura și Mawlid sunt deduse din grila calendarului, nu date explicit.
      islApprox: true, // calendarul le afișează ca aproximative (≈)
      isl: [
        [3, 9, 'Eid al-Fitr'], [3, 10, 'Eid al-Fitr'], [5, 15, 'Ziua Arafah'],
        [5, 16, 'Eid al-Adha'], [5, 17, 'Eid al-Adha'], [6, 6, 'An Nou Islamic'],
        [6, 15, 'Ashura'], [8, 14, 'Mawlid al-Nabi'],
      ],
    },
    // TODO 2027: CAS / CASS / impozit / deducere personală (și salariul minim, dacă
    // deducerea depinde de el) nu sunt confirmate oficial pentru 2027. Până atunci,
    // lunile din 2027 apar dezactivate în calculatorul de salariu. Completează aici
    // când apar actele normative — 2027 devine selectabil automat.
    salary: null,
  },
};

// ===== Utilitare =====
function _ymdKey(y, m, d) { return y + '-' + m + '-' + d; }

// Paștele ortodox (algoritmul Meeus pentru calendarul iulian, convertit în gregorian; valabil 1900–2099)
function computeOrthodoxEaster(year) {
  const a = year % 4, b = year % 7, c = year % 19;
  const d = (19 * c + 15) % 30;
  const e = (2 * a + 4 * b - d + 34) % 7;
  const month = Math.floor((d + e + 114) / 31);
  const day = ((d + e + 114) % 31) + 1;
  const dt = new Date(year, month - 1, day + 13);
  return [dt.getMonth() + 1, dt.getDate()];
}

function isYearConfigured(year) { return !!YEAR_CONFIG[year]; }
function configuredYears() { return Object.keys(YEAR_CONFIG).map(Number).sort((a, b) => a - b); }

function getOrthodoxEaster(year) {
  const cfg = YEAR_CONFIG[year];
  const computed = computeOrthodoxEaster(year);
  if (cfg && (cfg.orthodoxEaster[0] !== computed[0] || cfg.orthodoxEaster[1] !== computed[1])) {
    console.warn(`[year-config] Paștele ${year}: config ${cfg.orthodoxEaster.join('/')} ≠ calculat ${computed.join('/')}`);
  }
  return cfg ? cfg.orthodoxEaster : computed;
}

function _easterOffset(year, offset) {
  const [m, d] = getOrthodoxEaster(year);
  const dt = new Date(year, m - 1, d + offset);
  return [dt.getFullYear(), dt.getMonth() + 1, dt.getDate()];
}

// { 'Y-M-D': nume } — zilele libere legale ale anului (cache pe an)
const _legalCache = {};
function getLegalHolidaysForYear(year) {
  if (_legalCache[year]) return _legalCache[year];
  const out = {};
  for (const [m, d, name] of LEGAL_FIXED) out[_ymdKey(year, m, d)] = name;
  for (const [off, name] of LEGAL_FROM_EASTER) {
    const [y, m, d] = _easterOffset(year, off);
    const k = _ymdKey(y, m, d);
    if (!out[k]) out[k] = name; // ex. 1 iunie = Rusalii (2026): rămâne o singură zi liberă
  }
  return (_legalCache[year] = out);
}

// { 'Y-M-D': { name, type } } — sărbători religioase/culturale (cache pe an)
const _relCache = {};
function getReligiousHolidaysForYear(year) {
  if (_relCache[year]) return _relCache[year];
  const out = {};
  const add = (m, d, name, type, approx = false) => {
    const k = _ymdKey(year, m, d);
    if (!out[k]) out[k] = approx ? { name, type, approx } : { name, type };
  };
  for (const [m, d, name] of ORT_FIXED) add(m, d, name, 'ort');
  for (const [off, name] of ORT_FROM_EASTER) {
    const [, m, d] = _easterOffset(year, off);
    add(m, d, name, 'ort');
  }
  const rel = YEAR_CONFIG[year]?.religious;
  if (rel) {
    for (const [m, d, name] of rel.iud || []) add(m, d, name, 'iud');
    for (const [m, d, name] of rel.isl || []) add(m, d, name, 'isl', !!rel.islApprox);
  }
  return (_relCache[year] = out);
}

// Zile lucrătoare (L–V, fără sărbători legale) într-o lună; month = 0..11
function getWorkingDays(year, month) {
  const legal = getLegalHolidaysForYear(year);
  const days = new Date(year, month + 1, 0).getDate();
  let wd = 0;
  for (let d = 1; d <= days; d++) {
    const dow = new Date(year, month, d).getDay();
    if (dow !== 0 && dow !== 6 && !legal[_ymdKey(year, month + 1, d)]) wd++;
  }
  return wd;
}

// Norma lunii în ore (8h/zi lucrătoare); month = 0..11
function getNorma(year, month) {
  return getWorkingDays(year, month) * 8;
}

// Valorile fiscale pentru o lună (month = 0..11; implicit ianuarie), sau null dacă anul nu
// are valori confirmate oficial. Nu se împrumută niciodată valorile altui an.
function getSalaryRules(year, month = 0) {
  const s = YEAR_CONFIG[year]?.salary;
  if (!s) return null;
  const perioada = s.perioade.filter(p => p.dinLuna <= month + 1).pop();
  if (!perioada) return null;
  const { perioade, ...rest } = s;
  return { ...rest, ...perioada, year, month };
}
