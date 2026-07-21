import { buildPushPayload } from '@block65/webcrypto-web-push';

export interface Env {
  SUBSCRIPTIONS: KVNamespace;
  VAPID_PUBLIC_KEY: string;
  VAPID_SUBJECT: string;
  VAPID_PRIVATE_KEY: string; // secret
  ADMIN_TOKEN: string; // secret — gates the /test endpoint
  /**
   * Comma-separated origins allowed to (un)subscribe, e.g.
   * "https://maintenance.example.com,http://localhost:8081".
   * Empty/unset = allow every origin (pre-hardening behavior) so a deploy
   * without configuration can't lock the real app out.
   */
  ALLOWED_ORIGINS?: string;
}

const allowedOrigins = (env: Env): string[] =>
  (env.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

/** True when the request may register/remove subscriptions. */
function originAllowed(req: Request, env: Env): boolean {
  const allowed = allowedOrigins(env);
  if (allowed.length === 0) return true; // not configured yet
  const origin = req.headers.get('Origin');
  return origin != null && allowed.includes(origin);
}

/** CORS headers: reflect only allow-listed origins once the list is configured. */
function corsFor(req: Request, env: Env): Record<string, string> {
  const allowed = allowedOrigins(env);
  const origin = req.headers.get('Origin');
  const allowOrigin =
    allowed.length === 0 ? '*' : origin && allowed.includes(origin) ? origin : null;
  return {
    ...(allowOrigin ? { 'Access-Control-Allow-Origin': allowOrigin, Vary: 'Origin' } : {}),
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Token',
  };
}

const json = (obj: unknown, status = 200, cors: Record<string, string> = {}) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors },
  });

/** KV key derived from the subscription endpoint so re-subscribing is idempotent. */
async function keyFor(endpoint: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(endpoint));
  const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `sub:${hex}`;
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const cors = corsFor(req, env);
    const reply = (obj: unknown, status = 200) => json(obj, status, cors);
    if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
    const url = new URL(req.url);

    if (url.pathname === '/vapidPublicKey') {
      return reply({ publicKey: env.VAPID_PUBLIC_KEY });
    }

    if (url.pathname === '/subscribe' && req.method === 'POST') {
      if (!originAllowed(req, env)) return reply({ error: 'origin not allowed' }, 403);
      const sub = (await req.json().catch(() => null)) as any;
      if (!sub?.endpoint) return reply({ error: 'invalid subscription' }, 400);
      await env.SUBSCRIPTIONS.put(await keyFor(sub.endpoint), JSON.stringify(sub));
      return reply({ ok: true });
    }

    if (url.pathname === '/unsubscribe' && req.method === 'POST') {
      if (!originAllowed(req, env)) return reply({ error: 'origin not allowed' }, 403);
      const body = (await req.json().catch(() => null)) as any;
      if (body?.endpoint) await env.SUBSCRIPTIONS.delete(await keyFor(body.endpoint));
      return reply({ ok: true });
    }

    // Manual trigger for confirming delivery — requires the admin token.
    if (url.pathname === '/test' && req.method === 'POST') {
      if (req.headers.get('X-Admin-Token') !== env.ADMIN_TOKEN) return reply({ error: 'unauthorized' }, 401);
      const sent = await sendToAll(env, 'test');
      return reply({ sent });
    }

    return reply({ ok: true, service: 'maintenance-push' });
  },

  // Cron trigger (see wrangler.toml) — nudge every subscribed device.
  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(sendToAll(env, 'reminder'));
  },
};

/**
 * Send a content-less push to every subscription. The payload carries no
 * vehicle data — the device's service worker reads its own local snapshot and
 * renders the reminder, so personal data never reaches this server.
 * Dead subscriptions (404/410) are pruned.
 */
async function sendToAll(env: Env, kind: string): Promise<number> {
  const vapid = {
    subject: env.VAPID_SUBJECT,
    publicKey: env.VAPID_PUBLIC_KEY,
    privateKey: env.VAPID_PRIVATE_KEY,
  };
  let cursor: string | undefined;
  let sent = 0;
  do {
    const list = await env.SUBSCRIPTIONS.list({ cursor });
    for (const { name } of list.keys) {
      const raw = await env.SUBSCRIPTIONS.get(name);
      if (!raw) continue;
      const sub = JSON.parse(raw);
      try {
        const payload = await buildPushPayload(
          { data: JSON.stringify({ t: kind }), options: { ttl: 3600 } },
          sub,
          vapid,
        );
        const res = await fetch(sub.endpoint, payload);
        if (res.status === 404 || res.status === 410) await env.SUBSCRIPTIONS.delete(name);
        else sent++;
      } catch {
        /* transient error — leave the subscription in place for next time */
      }
    }
    cursor = (list as any).list_complete ? undefined : (list as any).cursor;
  } while (cursor);
  return sent;
}
