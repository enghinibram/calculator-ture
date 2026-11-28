// Tabelele cu norma din articole/pontaj-ture.html trebuie să corespundă cu year-config.js.
// Prinde commit-urile care au ocolit hook-ul de pre-commit (alt calculator, GitHub web, --no-verify).
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildArticle, loadYearConfig } from '../scripts/build-norma-tables.mjs';

test('pontaj-ture.html e la zi cu year-config.js', () => {
  const { html, next } = buildArticle();
  assert.ok(html === next, 'Rulează: node scripts/build-norma-tables.mjs');
});

test('totalurile anuale ale normei sunt cele verificate', () => {
  const cfg = loadYearConfig();
  const total = y => Array.from({ length: 12 }, (_, m) => cfg.getNorma(y, m)).reduce((a, b) => a + b);
  assert.equal(total(2026), 2000);
  assert.equal(total(2027), 2016);
});

test('articolul conține totalurile în HTML static', () => {
  const { html } = buildArticle();
  assert.match(html, /TOTAL 2026<\/strong><\/td><td><strong>250<\/strong><\/td><td><strong>2000 ore/);
  assert.match(html, /TOTAL 2027<\/strong><\/td><td><strong>252<\/strong><\/td><td><strong>2016 ore/);
});
