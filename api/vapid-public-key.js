// ---------------------------------------------------------------------
// FIȘIER: /api/vapid-public-key.js
// Expune cheia publică VAPID (necesară în browser pentru
// pushManager.subscribe) fără să o hardcodăm în app.js. Cheia privată
// rămâne doar server-side (Vercel + secretele Supabase Edge Function).
// ---------------------------------------------------------------------

export default function handler(req, res) {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  if (!publicKey) {
    return res.status(500).json({ error: 'VAPID_PUBLIC_KEY nu e configurat pe server.' });
  }
  res.status(200).json({ publicKey });
}
