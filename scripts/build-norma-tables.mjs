// Generează tabelele cu norma de ore din articole/pontaj-ture.html din year-config.js,
// ca HTML static (vizibil pentru crawlere fără JavaScript).
//
//   node scripts/build-norma-tables.mjs           → rescrie blocul dintre markeri
//   node scripts/build-norma-tables.mjs --check   → exit 1 dacă HTML-ul nu e la zi
//
// Rulat automat de .git/hooks/pre-commit când year-config.js e în commit, și
// verificat de tests/norma-tables.test.mjs. Fără dependențe.

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const CONFIG_PATH = path.join(ROOT, 'year-config.js');
export const ARTICLE_PATH = path.join(ROOT, 'articole', 'pontaj-ture.html');
const START = '<!-- NORMA:START — generat de scripts/build-norma-tables.mjs din year-config.js; nu edita manual -->';
const END = '<!-- NORMA:END -->';
const YEARS_SHOWN = 2; // ultimii N ani din YEAR_CONFIG — determinist, nu depinde de data curentă

const LUNI = ['Ianuarie', 'Februarie', 'Martie', 'Aprilie', 'Mai', 'Iunie', 'Iulie', 'August', 'Septembrie', 'Octombrie', 'Noiembrie', 'Decembrie'];
const ZILE = ['Du', 'Lu', 'Ma', 'Mi', 'Jo', 'Vi', 'Sâ'];

// year-config.js e un script clasic de browser: îl rulăm izolat și citim funcțiile globale
export function loadYearConfig(file = CONFIG_PATH) {
  const ctx = { console };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(file, 'utf8'), ctx, { filename: file });
  return ctx;
}

export function renderNormaTables(cfg) {
  const years = cfg.configuredYears().slice(-YEARS_SHOWN);
  const out = [];
  for (const y of years) {
    const legal = cfg.getLegalHolidaysForYear(y);
    let totalZile = 0, totalOre = 0;
    out.push(`      <h3>Norma de ore pe lună ${y}</h3>`);
    out.push('      <table>');
    out.push('        <thead><tr><th>Luna</th><th>Zile lucrătoare</th><th>Normă ore (8h/zi)</th><th>Zile libere legale în L–V</th></tr></thead>');
    out.push('        <tbody>');
    LUNI.forEach((luna, m) => {
      const zile = cfg.getWorkingDays(y, m);
      const ore = cfg.getNorma(y, m);
      totalZile += zile; totalOre += ore;
      const libere = Object.keys(legal)
        .map(k => k.split('-').map(Number))
        .filter(([yy, mm, dd]) => yy === y && mm === m + 1 && ![0, 6].includes(new Date(y, m, dd).getDay()))
        .sort((a, b) => a[2] - b[2])
        .map(([yy, mm, dd]) => `${ZILE[new Date(y, m, dd).getDay()]} ${dd} – ${legal[`${yy}-${mm}-${dd}`]}`)
        .join(', ') || '—';
      out.push(`          <tr><td>${luna}</td><td>${zile}</td><td>${ore} ore</td><td>${libere}</td></tr>`);
    });
    out.push(`          <tr class="total"><td><strong>TOTAL ${y}</strong></td><td><strong>${totalZile}</strong></td><td><strong>${totalOre} ore</strong></td><td></td></tr>`);
    out.push('        </tbody>');
    out.push('      </table>');
  }
  return out.join('\n');
}

export function applyToHtml(html, tables) {
  const a = html.indexOf(START);
  const b = html.indexOf(END);
  if (a === -1 || b === -1 || b < a) throw new Error(`Markerii NORMA lipsesc din ${ARTICLE_PATH}`);
  return html.slice(0, a + START.length) + '\n' + tables + '\n      ' + html.slice(b);
}

export function buildArticle() {
  const html = fs.readFileSync(ARTICLE_PATH, 'utf8');
  return { html, next: applyToHtml(html, renderNormaTables(loadYearConfig())) };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { html, next } = buildArticle();
  const rel = path.relative(ROOT, ARTICLE_PATH);
  if (process.argv.includes('--check')) {
    if (html !== next) {
      console.error(`✗ ${rel} nu corespunde cu year-config.js — rulează: node scripts/build-norma-tables.mjs`);
      process.exit(1);
    }
    console.log(`✓ ${rel} e la zi`);
  } else if (html !== next) {
    fs.writeFileSync(ARTICLE_PATH, next);
    console.log(`✓ ${rel}: tabelele cu norma regenerate`);
  } else {
    console.log(`✓ ${rel} era deja la zi`);
  }
}
