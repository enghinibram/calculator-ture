// Calculul salariului net (salary-calc.js + valorile din year-config.js).
// Cazurile de referință sunt calculate de mână după art. 77 Cod fiscal (deducerea personală),
// și HG 146/2026 (salariul minim 4.325 lei din 1 iulie 2026). Suma netaxabilă pentru salariul
// minim (OUG 89/2025) nu e inclusă în calcul, deci netul la salariul minim e sub cel publicat.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ctx = { console };
vm.createContext(ctx);
for (const f of ['year-config.js', 'salary-calc.js']) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
}
const { getSalaryRules, getDeducerePersonala, computeNetSalary, parseNumberOr } = ctx;

const IAN_2026 = getSalaryRules(2026, 0);
const IUL_2026 = getSalaryRules(2026, 6);
const calc = (rules, brut, extra = {}) => computeNetSalary({
  brut, oreNoapte: 0, oreExtra: 0, procentNoapte: 25, procentExtra: 75, norma: 168, dependenti: 0, ...extra,
}, rules);

test('salariul minim pe perioade: 4.050 până în iunie 2026, 4.325 din iulie', () => {
  assert.equal(getSalaryRules(2026, 0).salariuMinim, 4050);
  assert.equal(getSalaryRules(2026, 5).salariuMinim, 4050);
  assert.equal(getSalaryRules(2026, 6).salariuMinim, 4325);
  assert.equal(getSalaryRules(2026, 11).salariuMinim, 4325);
  assert.equal(getSalaryRules(2027, 0), null); // 2027 neconfirmat → fără calcul
});

test('deducerea la salariul minim: 20/25/30/35/45% din salariul minim', () => {
  assert.deepEqual([0, 1, 2, 3, 4, 7].map(d => getDeducerePersonala(4325, d, 4325)),
    [865, 1081, 1298, 1514, 1946, 1946]);
  assert.equal(getDeducerePersonala(3000, 0, 4325), 865); // sub minim (ex. normă parțială)
});

test('deducerea scade cu 0,5 puncte la fiecare 50 lei peste salariul minim', () => {
  assert.equal(getDeducerePersonala(4326, 0, 4325), 843);   // 19,5% × 4.325 = 843,375
  assert.equal(getDeducerePersonala(4375, 0, 4325), 843);   // aceeași tranșă
  assert.equal(getDeducerePersonala(4376, 0, 4325), 822);   // 19% × 4.325 = 821,75
  assert.equal(getDeducerePersonala(6275, 0, 4325), 22);    // tranșa 39: 0,5%
  assert.equal(getDeducerePersonala(6325, 0, 4325), 0);     // tranșa 40: 0%
  assert.equal(getDeducerePersonala(6325, 4, 4325), 1081);  // 4+ persoane: 45% − 20 = 25%
  assert.equal(getDeducerePersonala(6326, 4, 4325), 0);     // peste minim + 2.000 lei
});

test('net la salariul minim, iulie 2026: 2.616 lei (fără suma netaxabilă)', () => {
  const r = calc(IUL_2026, 4325);
  assert.equal(r.cas, 1081);     // 25% × 4.325 = 1.081,25
  assert.equal(r.cass, 433);     // 10% × 4.325 = 432,5
  assert.equal(r.deducere, 865);
  assert.equal(r.impozit, 195);  // 10% × (4.325 − 1.081 − 433 − 865) = 194,6
  assert.equal(r.net, 2616);
});

test('net la salariul minim, ianuarie 2026: 2.450 lei (fără suma netaxabilă)', () => {
  const r = calc(IAN_2026, 4050);
  assert.equal(r.cas, 1013);     // 25% × 4.050 = 1.012,5
  assert.equal(r.cass, 405);
  assert.equal(r.deducere, 810);
  assert.equal(r.impozit, 182);  // 10% × (4.050 − 1.013 − 405 − 810) = 182,2
  assert.equal(r.net, 2450);
});

test('nicio sumă netaxabilă: CAS și CASS se calculează din tot brutul', () => {
  const r = calc(IUL_2026, 4325);
  assert.equal(r.sumaNetaxabila, undefined);
  assert.equal(r.cas + r.cass, 1514); // 35% × 4.325, rotunjit pe componente
});

test('deducerea se calculează din brutul total, nu din salariul de bază', () => {
  // bază 5.000 + spor noapte 2.000 → 7.000 brut total > 6.325 → fără deducere
  const r = calc(IUL_2026, 5000, { oreNoapte: 268.8, procentNoapte: 25 });
  assert.equal(r.brutTotal, 7000);
  assert.equal(r.deducere, 0);
});

test('salariu de 5.000 lei, iulie 2026, fără persoane în întreținere', () => {
  // tranșa 14 (4.976–5.025): 20 − 7 = 13% × 4.325 = 562,25 → 562
  const r = calc(IUL_2026, 5000);
  assert.equal(r.cas, 1250);
  assert.equal(r.cass, 500);
  assert.equal(r.deducere, 562);
  assert.equal(r.impozit, 269); // 10% × (5.000 − 1.250 − 500 − 562) = 268,8
  assert.equal(r.net, 2981);
});

test('procent 0 introdus de utilizator rămâne 0; câmpul gol ia valoarea implicită', () => {
  assert.equal(parseNumberOr('0', 25), 0);
  assert.equal(parseNumberOr('', 25), 25);
  assert.equal(parseNumberOr('abc', 75), 75);
  assert.equal(parseNumberOr('12,5', 25), 12.5);
  const r = calc(IUL_2026, 5000, { oreNoapte: 40, procentNoapte: 0 });
  assert.equal(r.sporNoapte, 0);
});
