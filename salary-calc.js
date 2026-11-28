// ===== Calcul salariu net din brut (România) =====
// Folosit de calculator-salariu.html; testat în tests/salary-calc.test.mjs.
// Valorile (procente, salariul minim) vin din getSalaryRules(an, lună) din year-config.js;
// aici e doar formula.
//
// Ordinea de calcul (salariu la funcția de bază, normă întreagă):
//   1. brut total = salariul de bază + spor noapte + spor ore suplimentare
//   2. CAS 25% și CASS 10% din brutul total, rotunjite la leu
//   3. deducerea personală (art. 77 Cod fiscal), din brutul total și salariul minim
//   4. impozit 10% din (brut total − CAS − CASS − deducere), rotunjit la leu
//   5. net = brut total − CAS − CASS − impozit
// Suma netaxabilă pentru salariul minim (OUG 89/2025) nu e inclusă.

// Procentul din salariul minim pentru 0, 1, 2, 3, 4+ persoane în întreținere (art. 77 alin. (4))
const DEDUCERE_PROCENTE = [20, 25, 30, 35, 45];
const DEDUCERE_PLAFON_PESTE_MINIM = 2000; // peste salariul minim + 2.000 lei nu se acordă
const DEDUCERE_TRANSA = 50;               // procentul scade cu 0,5 puncte la fiecare 50 lei
const DEDUCERE_SCADERE_PE_TRANSA = 0.5;

// Rotunjire la leu; trecem întâi prin bani ca 412,5 să nu devină 412,4999… în virgulă mobilă
function roundLei(v) {
  return Math.round(Math.round(v * 100) / 100);
}

// Deducerea personală de bază pentru un venit brut lunar; lei întregi
function getDeducerePersonala(venitBrut, dependenti, salariuMinim) {
  if (!(venitBrut > 0)) return 0;
  const idx = Math.max(0, Math.min(Math.floor(dependenti) || 0, DEDUCERE_PROCENTE.length - 1));
  const peste = venitBrut - salariuMinim;
  if (peste > DEDUCERE_PLAFON_PESTE_MINIM) return 0;
  const transe = peste > 0 ? Math.ceil(peste / DEDUCERE_TRANSA) : 0;
  const procent = DEDUCERE_PROCENTE[idx] - transe * DEDUCERE_SCADERE_PE_TRANSA;
  return procent > 0 ? roundLei(salariuMinim * procent / 100) : 0;
}

// Număr din câmp; gol sau invalid → valoarea implicită, dar 0 rămâne 0
function parseNumberOr(value, fallback) {
  if (value === '' || value == null) return fallback;
  const n = typeof value === 'number' ? value : parseFloat(String(value).replace(',', '.'));
  return Number.isFinite(n) ? n : fallback;
}

function computeNetSalary(input, rules) {
  const brut          = input.brut;
  const norma         = input.norma;
  const tarifOrar     = brut / norma;
  const sporNoapte    = Math.round((input.oreNoapte || 0) * tarifOrar * input.procentNoapte) / 100;
  const sporExtra     = Math.round((input.oreExtra || 0) * tarifOrar * input.procentExtra) / 100;
  const brutTotal     = Math.round((brut + sporNoapte + sporExtra) * 100) / 100;

  const cas      = roundLei(brutTotal * rules.cas);
  const cass     = roundLei(brutTotal * rules.cass);
  const deducere = getDeducerePersonala(brutTotal, input.dependenti, rules.salariuMinim);
  const bazaImpozit = Math.max(0, brutTotal - cas - cass - deducere);
  const impozit  = roundLei(bazaImpozit * rules.impozit);
  const net      = Math.round((brutTotal - cas - cass - impozit) * 100) / 100;

  return { tarifOrar, sporNoapte, sporExtra, brutTotal, cas, cass, deducere, bazaImpozit, impozit, net };
}
