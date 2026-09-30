// ---------------------------------------------------------------------
// Trimite o notificare push de test către un singur dispozitiv, cu
// aceleași chei VAPID și aceeași librărie (web-push) ca Edge Function-ul
// send-shift-reminders. Rulează local, nu pe server.
//
// Pregătire (fișierele sunt ignorate de git, nu le comite):
//   1. .env.push-test în rădăcina repo-ului:
//        VAPID_SUBJECT=mailto:...
//        VAPID_PUBLIC_KEY=...
//        VAPID_PRIVATE_KEY=...
//      (aceleași valori ca secretele din Supabase)
//   2. push-subscription.json: textul copiat din /push-debug.html,
//      deschisă pe telefon, din aplicația instalată.
//
// Rulare:
//   npm install
//   node scripts/send-test-push.mjs [cale/către/push-subscription.json]
//
// Scriptul nu afișează cheile; arată doar dacă perechea VAPID e validă și
// răspunsul serviciului de push (Apple / Google / Mozilla).
// ---------------------------------------------------------------------

import { readFileSync } from 'node:fs';
import { createECDH } from 'node:crypto';
import { resolve } from 'node:path';
import webpush from 'web-push';

const ROOT = resolve(import.meta.dirname, '..');

function loadEnv(path) {
  const env = {};
  let text;
  try {
    text = readFileSync(path, 'utf8');
  } catch {
    fail(`Lipsește ${path}. Vezi instrucțiunile din capul scriptului.`);
  }
  for (const line of text.split('\n')) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return env;
}

function fail(msg) {
  console.error('✗ ' + msg);
  process.exit(1);
}

const env = loadEnv(resolve(ROOT, '.env.push-test'));
for (const k of ['VAPID_SUBJECT', 'VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY']) {
  if (!env[k]) fail(`${k} lipsește din .env.push-test.`);
}

// Subject-ul trebuie să fie mailto: sau https:// public; Apple respinge
// altfel cu 403 BadJwtToken.
if (!/^mailto:[^\s@]+@[^\s@]+$/.test(env.VAPID_SUBJECT) && !/^https:\/\/(?!localhost)[^\s]+$/.test(env.VAPID_SUBJECT)) {
  fail('VAPID_SUBJECT nu arată ca „mailto:adresa@domeniu” sau un URL https:// public.');
}
console.log('✓ VAPID_SUBJECT are un format valid.');

// Cheia privată trebuie să genereze exact cheia publică dată clientului.
try {
  const ecdh = createECDH('prime256v1');
  ecdh.setPrivateKey(Buffer.from(env.VAPID_PRIVATE_KEY, 'base64url'));
  const derived = ecdh.getPublicKey().toString('base64url');
  if (derived !== env.VAPID_PUBLIC_KEY) fail('Cheia privată VAPID NU corespunde cheii publice.');
} catch (err) {
  fail('Cheia privată VAPID nu e validă: ' + err.message);
}
console.log('✓ Perechea de chei VAPID e validă.');

const subPath = resolve(process.argv[2] || resolve(ROOT, 'push-subscription.json'));
let subscription;
try {
  subscription = JSON.parse(readFileSync(subPath, 'utf8'));
} catch (err) {
  fail(`Nu am putut citi abonamentul din ${subPath}: ${err.message}`);
}
if (!subscription.endpoint || !subscription.keys?.p256dh || !subscription.keys?.auth) {
  fail('Abonamentul trebuie să conțină endpoint, keys.p256dh și keys.auth.');
}
console.log(`→ Trimit către ${new URL(subscription.endpoint).host} ...`);

webpush.setVapidDetails(env.VAPID_SUBJECT, env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY);

const payload = JSON.stringify({
  title: 'Calculator Ture',
  body: `Notificare de test (${new Date().toLocaleTimeString('ro-RO')}).`,
  url: '/push-debug.html',
});

try {
  const res = await webpush.sendNotification(subscription, payload, { TTL: 300, urgency: 'high' });
  console.log(`✓ Acceptat de serviciul de push (HTTP ${res.statusCode}). Notificarea ar trebui să apară pe telefon.`);
} catch (err) {
  const code = err.statusCode;
  console.error(`✗ Respins (HTTP ${code ?? '?'}): ${err.body || err.message}`);
  if (code === 404 || code === 410) console.error('  Abonamentul a expirat: reactivează notificările din aplicație.');
  if (code === 403) console.error('  Probleme cu VAPID: subject invalid sau chei diferite față de cele cu care s-a creat abonamentul.');
  process.exit(1);
}
