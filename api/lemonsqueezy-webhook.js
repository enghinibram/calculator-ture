import crypto from 'crypto';

// Body-ul RAW e obligatoriu pentru verificarea semnăturii HMAC —
// dezactivăm parsarea automată JSON a lui Vercel.
export const config = {
  api: {
    bodyParser: false,
  },
};

const SUBSCRIPTION_EVENTS = new Set([
  'subscription_created',
  'subscription_updated',
  'subscription_cancelled',
  'subscription_expired',
]);

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function isValidSignature(rawBody, signatureHeader, secret) {
  if (!signatureHeader) return false;
  const digest = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  const sigBuffer = Buffer.from(signatureHeader, 'utf8');
  const digestBuffer = Buffer.from(digest, 'utf8');
  if (sigBuffer.length !== digestBuffer.length) return false;
  return crypto.timingSafeEqual(sigBuffer, digestBuffer);
}

function planForVariant(variantId) {
  if (variantId === process.env.LEMONSQUEEZY_VARIANT_MONTHLY) return 'monthly';
  if (variantId === process.env.LEMONSQUEEZY_VARIANT_YEARLY) return 'yearly';
  return null;
}

// Starea de premium și data de expirare vin direct din payload
// (renews_at / ends_at), nu dintr-un calcul +30/+365 zile — Lemon Squeezy
// știe exact datele de facturare (retry-uri, grace period etc).
//
// status "cancelled" NU înseamnă acces terminat — userul a oprit
// reînnoirea, dar rămâne activ până la ends_at (perioada deja plătită).
function resolvePremiumState(attrs) {
  const status = attrs.status;
  if (status === 'active' || status === 'on_trial') {
    return { isPremium: true, expiresAt: attrs.renews_at };
  }
  if (status === 'cancelled') {
    return { isPremium: true, expiresAt: attrs.ends_at };
  }
  // expired, unpaid, paused etc. — acces terminat
  return { isPremium: false, expiresAt: attrs.ends_at || null };
}

async function findUserIdByEmail(supabaseUrl, supabaseSecretKey, email) {
  const res = await fetch(`${supabaseUrl}/rest/v1/rpc/get_user_id_by_email`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: supabaseSecretKey,
      Authorization: `Bearer ${supabaseSecretKey}`,
    },
    body: JSON.stringify({ lookup_email: email }),
  });
  if (!res.ok) {
    throw new Error(`RPC get_user_id_by_email a eșuat: ${res.status} ${await res.text()}`);
  }
  return res.json(); // uuid string sau null
}

async function upsertPremiumStatus(supabaseUrl, supabaseSecretKey, row) {
  const res = await fetch(`${supabaseUrl}/rest/v1/premium_status?on_conflict=user_id`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: supabaseSecretKey,
      Authorization: `Bearer ${supabaseSecretKey}`,
      Prefer: 'resolution=merge-duplicates',
    },
    body: JSON.stringify(row),
  });
  if (!res.ok) {
    throw new Error(`Upsert premium_status a eșuat: ${res.status} ${await res.text()}`);
  }
}

// client_id-ul GA4 vine din checkout[custom][client_id], atașat la link-ul
// de checkout în browser (vezi startCheckout() din app.js) și întors de
// Lemon Squeezy în payload la meta.custom_data.client_id.
async function sendGA4Event(clientId, eventName, params) {
  const measurementId = process.env.GA4_MEASUREMENT_ID;
  const apiSecret = process.env.GA4_API_SECRET;
  if (!measurementId || !apiSecret || !clientId) return;

  try {
    await fetch(
      `https://www.google-analytics.com/mp/collect?measurement_id=${measurementId}&api_secret=${apiSecret}`,
      {
        method: 'POST',
        body: JSON.stringify({
          client_id: clientId,
          events: [{ name: eventName, params }],
        }),
      }
    );
  } catch {
    // non-critic — nu blocăm webhook-ul dacă GA4 e indisponibil
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const webhookSecret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET;
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

  if (!webhookSecret || !supabaseUrl || !supabaseSecretKey) {
    return res.status(500).json({ error: 'Lipsesc variabile de mediu pe server.' });
  }

  const rawBody = await readRawBody(req);

  if (!isValidSignature(rawBody, req.headers['x-signature'], webhookSecret)) {
    return res.status(401).json({ error: 'Semnătură invalidă.' });
  }

  let payload;
  try {
    payload = JSON.parse(rawBody.toString('utf8'));
  } catch {
    return res.status(400).json({ error: 'Payload JSON invalid.' });
  }

  const eventName = payload?.meta?.event_name;
  const attrs = payload?.data?.attributes;

  if (!SUBSCRIPTION_EVENTS.has(eventName) || !attrs) {
    // Alte evenimente (order_created etc.) — le confirmăm dar nu facem nimic.
    return res.status(200).json({ ignored: true, event: eventName ?? null });
  }

  const email = attrs.user_email;
  if (!email) {
    return res.status(400).json({ error: 'Lipsește user_email din payload.' });
  }

  const plan = planForVariant(String(attrs.variant_id));
  const { isPremium, expiresAt } = resolvePremiumState(attrs);

  try {
    const userId = await findUserIdByEmail(supabaseUrl, supabaseSecretKey, email);

    if (!userId) {
      // Cineva a plătit dar nu are cont (încă) pe calculatorture — nimic de legat.
      return res.status(200).json({ warning: 'Niciun cont găsit pentru acest email.', email });
    }

    const row = {
      user_id: userId,
      is_premium: isPremium,
      plan,
      premium_expires: expiresAt,
      lemon_squeezy_subscription_id: String(payload.data.id),
      // TEMPORAR: push_product_active e ținut sincron cu is_premium (activ
      // cât abonamentul e activ, oprit la expirare) fiindcă azi push-ul e
      // doar un beneficiu inclus în Premium, fără flow propriu de vânzare.
      // Planul e ca push să devină vandabil separat, standalone, și la useri
      // non-Premium — când se întâmplă asta, push_product_active NU mai
      // trebuie setat automat aici, ci printr-un toggle/flow de plată
      // dedicat. Nu presupune că is_premium și push_product_active rămân
      // mereu identice.
      push_product_active: isPremium,
    };
    // premium_since = data reală de creare a abonamentului (nu "acum"),
    // și doar când userul e premium — la expirare păstrăm istoricul.
    if (isPremium) {
      row.premium_since = attrs.created_at || new Date().toISOString();
    }

    await upsertPremiumStatus(supabaseUrl, supabaseSecretKey, row);

    if (eventName === 'subscription_created') {
      const clientId = payload?.meta?.custom_data?.client_id;
      await sendGA4Event(clientId, 'plata_confirmata', { plan });
    }

    return res.status(200).json({ ok: true, email, plan, isPremium });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
