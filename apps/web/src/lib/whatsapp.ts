/**
 * WhatsApp via Evolution API (self-hosted Baileys, per D-023).
 *
 * Antagna talks to Evolution over HTTP. Evolution sends events back via the
 * webhook at /api/integrations/whatsapp/webhook.
 *
 * Local dev / production both use Cloudflare Tunnel to expose the locally-
 * running Evolution daemon. The endpoint URL goes in WHATSAPP_API_URL.
 */

const INSTANCE = process.env.WHATSAPP_INSTANCE_NAME ?? 'antagna';

export interface EvolutionConfig {
  baseUrl: string;
  apiKey: string;
  instance: string;
}

export function getEvolutionConfig(): EvolutionConfig {
  const baseUrl = process.env.WHATSAPP_API_URL;
  const apiKey = process.env.WHATSAPP_API_KEY;
  if (!baseUrl) throw new Error('WHATSAPP_API_URL is not set');
  if (!apiKey) throw new Error('WHATSAPP_API_KEY is not set');
  return { baseUrl: baseUrl.replace(/\/$/, ''), apiKey, instance: INSTANCE };
}

async function evoFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const cfg = getEvolutionConfig();
  return fetch(`${cfg.baseUrl}${path}`, {
    ...init,
    headers: {
      apikey: cfg.apiKey,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
}

/**
 * Create the WhatsApp instance on Evolution (idempotent — Evolution will
 * return an existing instance if it already exists with this name).
 */
export async function createInstance(): Promise<{ ok: boolean; raw: unknown }> {
  const cfg = getEvolutionConfig();
  const res = await evoFetch('/instance/create', {
    method: 'POST',
    body: JSON.stringify({
      instanceName: cfg.instance,
      qrcode: true,
      integration: 'WHATSAPP-BAILEYS',
    }),
  });
  const raw = await res.json().catch(() => ({}));
  return { ok: res.ok, raw };
}

/**
 * Returns the connection state — 'open' (paired), 'connecting' (waiting for
 * QR), 'close' (disconnected).
 */
export async function getConnectionState(): Promise<{
  ok: boolean;
  state?: 'open' | 'connecting' | 'close';
  raw: unknown;
}> {
  const cfg = getEvolutionConfig();
  const res = await evoFetch(
    `/instance/connectionState/${encodeURIComponent(cfg.instance)}`,
  );
  const raw = (await res.json().catch(() => ({}))) as {
    instance?: { state?: 'open' | 'connecting' | 'close' };
  };
  return { ok: res.ok, state: raw.instance?.state, raw };
}

/**
 * Fetch the current QR code (base64 data URL). Useful to display in the
 * admin UI for the initial pairing scan.
 */
export async function getQrCode(): Promise<{
  ok: boolean;
  base64?: string;
  pairingCode?: string;
  raw: unknown;
}> {
  const cfg = getEvolutionConfig();
  const res = await evoFetch(`/instance/connect/${encodeURIComponent(cfg.instance)}`);
  const raw = (await res.json().catch(() => ({}))) as {
    base64?: string;
    code?: string;
    pairingCode?: string;
  };
  return {
    ok: res.ok,
    base64: raw.base64,
    pairingCode: raw.pairingCode,
    raw,
  };
}

/**
 * Disconnect the WhatsApp session (forces a new QR next pairing).
 */
export async function logout(): Promise<{ ok: boolean; raw: unknown }> {
  const cfg = getEvolutionConfig();
  const res = await evoFetch(
    `/instance/logout/${encodeURIComponent(cfg.instance)}`,
    { method: 'DELETE' },
  );
  const raw = await res.json().catch(() => ({}));
  return { ok: res.ok, raw };
}

/**
 * Send a plain text WhatsApp message. `toE164` should include the leading
 * `+` (e.g. +966501234567). Evolution accepts either format but we normalize
 * to digits-only as that's what Baileys requires internally.
 */
export async function sendText(
  toE164: string,
  body: string,
): Promise<{ ok: boolean; messageId?: string; raw: unknown }> {
  const cfg = getEvolutionConfig();
  const digits = toE164.replace(/[^0-9]/g, '');
  const res = await evoFetch(
    `/message/sendText/${encodeURIComponent(cfg.instance)}`,
    {
      method: 'POST',
      body: JSON.stringify({
        number: digits,
        text: body,
      }),
    },
  );
  const raw = (await res.json().catch(() => ({}))) as {
    key?: { id?: string };
  };
  return { ok: res.ok, messageId: raw.key?.id, raw };
}
