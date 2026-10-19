// Rulare: node --test tests/
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { EventEmitter } from 'node:events';

import handler from '../api/lemonsqueezy-webhook.js';

// Valori false, doar pentru teste.
const ENV = {
  LEMONSQUEEZY_WEBHOOK_SECRET: 'test-webhook-secret',
  SUPABASE_URL: 'https://supabase.test',
  SUPABASE_SECRET_KEY: 'test-supabase-key',
  LEMONSQUEEZY_VARIANT_MONTHLY: 'test-variant-monthly',
  LEMONSQUEEZY_VARIANT_YEARLY: 'test-variant-yearly',
};

let savedEnv;
let savedFetch;
let fetchCalls;

beforeEach(() => {
  savedEnv = { ...process.env };
  savedFetch = globalThis.fetch;
  Object.assign(process.env, ENV);
  delete process.env.GA4_MEASUREMENT_ID;
  delete process.env.GA4_API_SECRET;
  fetchCalls = [];
});

afterEach(() => {
  process.env = savedEnv;
  globalThis.fetch = savedFetch;
});

function mockFetch(responder) {
  globalThis.fetch = async (url, init) => {
    fetchCalls.push({ url: String(url), init });
    return responder(String(url), init);
  };
}

function jsonResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

function sign(body, secret = ENV.LEMONSQUEEZY_WEBHOOK_SECRET) {
  return crypto.createHmac('sha256', secret).update(body).digest('hex');
}

function payload(variantId, overrides = {}) {
  return JSON.stringify({
    meta: { event_name: 'subscription_created' },
    data: {
      id: 'sub-test-1',
      attributes: {
        variant_id: variantId,
        user_email: 'user@example.test',
        status: 'active',
        renews_at: '2026-11-19T00:00:00.000Z',
        ends_at: null,
        created_at: '2026-10-19T00:00:00.000Z',
        ...overrides,
      },
    },
  });
}

function makeReq(body, signature) {
  const req = new EventEmitter();
  req.method = 'POST';
  req.headers = signature === null ? {} : { 'x-signature': signature };
  process.nextTick(() => {
    req.emit('data', Buffer.from(body, 'utf8'));
    req.emit('end');
  });
  return req;
}

function makeRes() {
  const res = { statusCode: null, body: undefined };
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (body) => {
    res.body = body;
    return res;
  };
  res.end = () => res;
  return res;
}

async function call(body, signature = sign(body)) {
  const res = makeRes();
  await handler(makeReq(body, signature), res);
  return res;
}

test('variantă cunoscută: caută userul și face upsert cu planul corect', async () => {
  mockFetch((url) => {
    if (url.includes('/rpc/get_user_id_by_email')) return jsonResponse(200, 'user-uuid-test');
    if (url.includes('/premium_status')) return jsonResponse(201, null);
    throw new Error(`fetch neașteptat: ${url}`);
  });

  const res = await call(payload(ENV.LEMONSQUEEZY_VARIANT_MONTHLY));

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { ok: true, email: 'user@example.test', plan: 'monthly', isPremium: true });
  assert.equal(fetchCalls.length, 2);

  const row = JSON.parse(fetchCalls[1].init.body);
  assert.equal(row.user_id, 'user-uuid-test');
  assert.equal(row.plan, 'monthly');
  assert.equal(row.is_premium, true);
  assert.equal(row.premium_expires, '2026-11-19T00:00:00.000Z');
  assert.equal(row.lemon_squeezy_subscription_id, 'sub-test-1');
  assert.equal(row.push_product_active, true);
  assert.equal(row.premium_since, '2026-10-19T00:00:00.000Z');
});

test('variantă cunoscută (yearly, variant_id numeric în payload) e recunoscută', async () => {
  process.env.LEMONSQUEEZY_VARIANT_YEARLY = '424242';
  mockFetch((url) => {
    if (url.includes('/rpc/get_user_id_by_email')) return jsonResponse(200, 'user-uuid-test');
    return jsonResponse(201, null);
  });

  const res = await call(payload(424242));

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.plan, 'yearly');
  assert.equal(JSON.parse(fetchCalls[1].init.body).plan, 'yearly');
});

test('variantă necunoscută: 200 ignored și niciun apel la baza de date', async () => {
  mockFetch(() => {
    throw new Error('nu trebuie apelat');
  });

  const res = await call(payload('some-other-product-variant'));

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { ok: true, ignored: true });
  assert.equal(fetchCalls.length, 0);
});

test('variantă necunoscută cu GA4 configurat: niciun eveniment GA4 trimis', async () => {
  process.env.GA4_MEASUREMENT_ID = 'G-TEST';
  process.env.GA4_API_SECRET = 'test-ga4-secret';
  mockFetch((url) => {
    if (url.includes('/rpc/get_user_id_by_email')) return jsonResponse(200, 'user-uuid-test');
    return jsonResponse(200, null);
  });

  const body = JSON.stringify({
    ...JSON.parse(payload('some-other-product-variant')),
    meta: { event_name: 'subscription_created', custom_data: { client_id: 'ga-client-test' } },
  });
  const res = await call(body);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { ok: true, ignored: true });
  assert.equal(fetchCalls.length, 0);
});

test('variantă necunoscută fără user_email: tot 200 ignored, nu 400', async () => {
  mockFetch(() => {
    throw new Error('nu trebuie apelat');
  });

  const res = await call(payload('some-other-product-variant', { user_email: undefined }));

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { ok: true, ignored: true });
  assert.equal(fetchCalls.length, 0);
});

test('semnătură invalidă: 401 și niciun apel la baza de date', async () => {
  mockFetch(() => {
    throw new Error('nu trebuie apelat');
  });

  const body = payload(ENV.LEMONSQUEEZY_VARIANT_MONTHLY);
  const res = await call(body, sign(body, 'wrong-secret'));

  assert.equal(res.statusCode, 401);
  assert.equal(fetchCalls.length, 0);
});

test('semnătură lipsă: 401, chiar și pentru variantă necunoscută', async () => {
  mockFetch(() => {
    throw new Error('nu trebuie apelat');
  });

  const res = await call(payload('some-other-product-variant'), null);

  assert.equal(res.statusCode, 401);
  assert.equal(fetchCalls.length, 0);
});

test('eroare Supabase la variantă cunoscută: 500 (Lemon Squeezy reîncearcă)', async (t) => {
  t.mock.method(console, 'error', () => {});
  mockFetch(() => jsonResponse(503, null));

  const res = await call(payload(ENV.LEMONSQUEEZY_VARIANT_MONTHLY));

  assert.equal(res.statusCode, 500);
});

test('variante lipsă din env: 500, nu ignorare silențioasă', async () => {
  delete process.env.LEMONSQUEEZY_VARIANT_YEARLY;
  mockFetch(() => {
    throw new Error('nu trebuie apelat');
  });

  const res = await call(payload('some-other-product-variant'));

  assert.equal(res.statusCode, 500);
  assert.equal(fetchCalls.length, 0);
});
