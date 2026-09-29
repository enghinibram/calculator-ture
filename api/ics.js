// ---------------------------------------------------------------------
// FIȘIER: /api/ics.js
// Întoarce fișierul .ics generat în browser, cu Content-Type text/calendar,
// ca Safari pe iPhone să pornească importul nativ în Calendar (o adresă
// blob:/data: nu e trimisă către Calendar). Primește conținutul printr-un
// formular POST (câmpul „ics”), ca programul de ture să nu apară în URL.
// Fără bază de date, fără stocare; acceptă doar un VCALENDAR de max. 200 KB.
// ---------------------------------------------------------------------

// Citim corpul brut ca să putem impune limita de dimensiune înainte de parsare.
export const config = {
  api: {
    bodyParser: false,
  },
};

const MAX_BYTES = 200 * 1024;

function readRawBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(Object.assign(new Error('Payload prea mare'), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).send('Metodă nepermisă.');
  }

  let raw;
  try {
    raw = await readRawBody(req, MAX_BYTES);
  } catch (err) {
    return res.status(err.status || 400).send('Cerere invalidă.');
  }

  const ics = new URLSearchParams(raw.toString('utf8')).get('ics') || '';
  const trimmed = ics.trim();
  if (!trimmed.startsWith('BEGIN:VCALENDAR') || !trimmed.endsWith('END:VCALENDAR')) {
    return res.status(400).send('Conținut invalid.');
  }

  const filename = /^[\w.-]{1,80}\.ics$/.test(req.query?.f || '') ? req.query.f : 'ture.ics';

  res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
  res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.status(200).send(ics);
}
