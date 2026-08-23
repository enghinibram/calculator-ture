// ---------------------------------------------------------------------
// FIȘIER: /api/cron/run-compliance-check.js
// Apelat automat de Vercel Cron (vezi vercel.json), o dată pe zi.
// Rolul lui: să apeleze Edge Function-ul din Supabase cu secretul corect,
// fără să expună CRON_SECRET-ul Supabase în client sau în vercel.json.
// ---------------------------------------------------------------------

export default async function handler(req, res) {
  // Vercel Cron trimite automat acest header — verificăm ca să nu poată
  // oricine declanșa manual acest endpoint din exterior.
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.VERCEL_CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const response = await fetch(
      'https://gtgjwriutlyhvfoyucsq.supabase.co/functions/v1/validate-compliance',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.SUPABASE_CRON_SECRET}`,
        },
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error('Eroare la validate-compliance:', data);
      return res.status(502).json({ error: 'Supabase function failed', details: data });
    }

    console.log('Compliance check rulat cu succes:', data);
    return res.status(200).json(data);
  } catch (err) {
    console.error('Eroare la apelarea funcției de compliance:', err);
    return res.status(500).json({ error: err.message });
  }
}
