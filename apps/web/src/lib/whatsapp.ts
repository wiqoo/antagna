/**
 * WhatsApp gateway — WPPConnect Server (whatsapp-web.js / Puppeteer based).
 *
 * Antagna talks to a local self-hosted instance over Cloudflare Tunnel.
 * The endpoint URL lives in WHATSAPP_API_URL (e.g. https://whatsapp.antagna.me),
 * the shared secret in WHATSAPP_API_KEY, and the session name in
 * WHATSAPP_INSTANCE_NAME (defaults to "antagna").
 *
 * Auth flow: each call mints a fresh per-session token via /generate-token
 * (cheap), then uses it as Bearer for the actual request. Mapping the
 * WPPConnect state enum to the simpler 'open' | 'connecting' | 'close'
 * the admin UI already speaks.
 */

const INSTANCE = process.env.WHATSAPP_INSTANCE_NAME ?? 'antagna';

export interface WppConfig {
  baseUrl: string;
  secret: string;
  session: string;
}

export function getWppConfig(): WppConfig {
  const baseUrl = process.env.WHATSAPP_API_URL;
  const secret = process.env.WHATSAPP_API_KEY;
  if (!baseUrl) throw new Error('WHATSAPP_API_URL is not set');
  if (!secret) throw new Error('WHATSAPP_API_KEY is not set');
  return { baseUrl: baseUrl.replace(/\/$/, ''), secret, session: INSTANCE };
}

async function mintToken(): Promise<string> {
  const cfg = getWppConfig();
  const res = await fetch(
    `${cfg.baseUrl}/api/${encodeURIComponent(cfg.session)}/${encodeURIComponent(cfg.secret)}/generate-token`,
    { method: 'POST' },
  );
  if (!res.ok) {
    throw new Error(`mintToken failed: ${res.status} ${await res.text()}`);
  }
  const json = (await res.json()) as { token?: string; full?: string };
  if (!json.token) throw new Error('generate-token returned no token');
  return json.token;
}

async function wppFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const cfg = getWppConfig();
  const token = await mintToken();
  return fetch(`${cfg.baseUrl}/api/${encodeURIComponent(cfg.session)}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
}

// ── public surface (mirrors what the admin UI / webhooks expect) ─────────────

/**
 * Idempotent: starts the session if not already running. WPPConnect will
 * eventually emit a QR via the connection (read it via getQrCode).
 */
export async function createInstance(): Promise<{ ok: boolean; raw: unknown }> {
  const res = await wppFetch('/start-session', {
    method: 'POST',
    body: JSON.stringify({ waitQrCode: false }),
  });
  const raw = await res.json().catch(() => ({}));
  return { ok: res.ok, raw };
}

type WppRawState =
  | 'CLOSED'
  | 'INITIALIZING'
  | 'STARTING'
  | 'QRCODE'
  | 'CONNECTED'
  | 'CONNECTED.INSIDE'
  | 'DISCONNECTED'
  | string;

function mapState(s: WppRawState | undefined): 'open' | 'connecting' | 'close' {
  if (!s) return 'close';
  if (s === 'CONNECTED' || s.startsWith('CONNECTED')) return 'open';
  if (s === 'CLOSED' || s === 'DISCONNECTED') return 'close';
  return 'connecting'; // INITIALIZING / STARTING / QRCODE / etc.
}

export async function getConnectionState(): Promise<{
  ok: boolean;
  state?: 'open' | 'connecting' | 'close';
  raw: unknown;
}> {
  const res = await wppFetch('/status-session', { method: 'GET' });
  const raw = (await res.json().catch(() => ({}))) as { status?: string };
  return { ok: res.ok, state: mapState(raw.status), raw };
}

/**
 * Fetch the QR. WPPConnect returns `image/png` (raw bytes) when one is
 * ready, or a JSON `{status, message}` while initializing. We hide both
 * shapes behind a single base64 result.
 */
export async function getQrCode(): Promise<{
  ok: boolean;
  base64?: string;
  pairingCode?: string;
  raw: unknown;
}> {
  const res = await wppFetch('/qrcode-session', { method: 'GET' });
  const ct = res.headers.get('content-type') ?? '';
  if (ct.startsWith('image/')) {
    const buf = Buffer.from(await res.arrayBuffer());
    const mime = ct.split(';')[0]?.trim() ?? 'image/png';
    return {
      ok: true,
      base64: `data:${mime};base64,${buf.toString('base64')}`,
      raw: { mime, bytes: buf.length },
    };
  }
  const raw = (await res.json().catch(() => ({}))) as {
    status?: string;
    message?: string;
  };
  return { ok: res.ok, raw };
}

export async function logout(): Promise<{ ok: boolean; raw: unknown }> {
  const res = await wppFetch('/logout-session', { method: 'POST' });
  const raw = await res.json().catch(() => ({}));
  return { ok: res.ok, raw };
}

export async function sendText(
  toE164: string,
  body: string,
): Promise<{ ok: boolean; messageId?: string; raw: unknown }> {
  // WPPConnect wants a digit-only number (no +).
  const phone = toE164.replace(/[^0-9]/g, '');
  const res = await wppFetch('/send-message', {
    method: 'POST',
    body: JSON.stringify({ phone, message: body, isGroup: false }),
  });
  const raw = (await res.json().catch(() => ({}))) as {
    response?: { id?: { _serialized?: string } };
  };
  return {
    ok: res.ok,
    messageId: raw.response?.id?._serialized,
    raw,
  };
}

/**
 * Show the "typing..." indicator to the recipient. Fire-and-forget — we
 * don't block on it. The recipient sees the indicator until either we
 * call setTyping(phone, false) or WhatsApp times it out (~10s).
 */
export async function setTyping(toE164: string, value: boolean): Promise<void> {
  const phone = toE164.replace(/[^0-9]/g, '');
  try {
    await wppFetch('/typing', {
      method: 'POST',
      body: JSON.stringify({ phone, value, isGroup: false }),
    });
  } catch {
    // Best-effort — never let typing indicator failures break the bot.
  }
}

// ── LID → phone resolution ───────────────────────────────────────────────────
// WhatsApp's @lid hides the phone number INSIDE the message, but the session
// (the linked phone) still knows the real number for any SAVED contact. We ask
// the session via WPPConnect's getPnLidEntry — REST route
// `GET /api/:session/contact/pn-lid/:pnLid`, which returns { lid, phoneNumber,
// contact }. For an unsaved stranger with privacy on, WhatsApp genuinely never
// gives the number → returns null and the chat stays a LID.

/** Coerce a Wid / serialized-JID / digit string into +E.164. Null for @lid/@g.us. */
function widToE164(v: unknown): string | null {
  if (typeof v === 'string') {
    const at = v.indexOf('@');
    const local = at === -1 ? v : v.slice(0, at);
    const suffix = at === -1 ? '' : v.slice(at + 1);
    // Only c.us / s.whatsapp.net are real phones; @lid/@g.us are not.
    if (suffix && suffix !== 'c.us' && suffix !== 's.whatsapp.net') return null;
    const digits = local.replace(/[^0-9]/g, '');
    return digits.length >= 7 ? `+${digits}` : null;
  }
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    return widToE164(o._serialized) ?? widToE164(o.user) ?? null;
  }
  return null;
}

/** Dig the real phone out of a getPnLidEntry response, tolerant of the exact
 *  shape (wppconnect/wa-js versions differ): top-level phoneNumber/pn/wid/id, a
 *  { status, response } envelope, or a nested contact object. */
function extractPnLidPhone(json: unknown): string | null {
  if (!json || typeof json !== 'object') return null;
  const top = json as Record<string, unknown>;
  const r =
    top.response && typeof top.response === 'object'
      ? (top.response as Record<string, unknown>)
      : top;
  for (const key of ['phoneNumber', 'pn', 'phone', 'wid', 'id']) {
    const e = widToE164(r[key]);
    if (e) return e;
  }
  if (r.contact && typeof r.contact === 'object') {
    const c = r.contact as Record<string, unknown>;
    for (const key of ['phoneNumber', 'id', 'wid']) {
      const e = widToE164(c[key]);
      if (e) return e;
    }
  }
  return null;
}

/**
 * Resolve an @lid to a real +E.164 by asking the WhatsApp session's contact
 * store. Works when the contact is SAVED on the session phone (the common case
 * the operator hit). Returns null when the number is genuinely unavailable
 * (unsaved + privacy-hidden) or the lookup fails — never throws.
 *
 * `lid` may be the bare digits or `lid:NNN` / `NNN@lid` — we normalize.
 */
export async function resolveLidToPhone(lid: string): Promise<string | null> {
  const digits = lid.replace(/[^0-9]/g, '');
  if (!digits) return null;
  try {
    const res = await wppFetch(
      `/contact/pn-lid/${encodeURIComponent(`${digits}@lid`)}`,
      { method: 'GET' },
    );
    if (!res.ok) {
      console.error('[whatsapp] pn-lid lookup HTTP', res.status, await res.text().catch(() => ''));
      return null;
    }
    const json = (await res.json().catch(() => null)) as unknown;
    const phone = extractPnLidPhone(json);
    if (!phone) {
      // Log the raw shape once so we can refine the parser if a version differs.
      console.warn('[whatsapp] pn-lid no phone for', digits, JSON.stringify(json)?.slice(0, 400));
    }
    return phone;
  } catch (e) {
    console.error('[whatsapp] resolveLidToPhone error', e);
    return null;
  }
}
