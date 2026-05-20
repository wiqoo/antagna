import { OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';
import { eq, isNull, and } from 'drizzle-orm';
import { db, googleIntegrations } from '@antagna/db';

/**
 * Scopes we ask Google for. Tightest set that supports:
 *  - reading Gmail (info@voltsaudi.com)
 *  - reading + writing Drive
 *  - reading + writing Calendar
 *  - knowing which account authorized us
 */
export const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/userinfo.email',
  'openid',
];

/**
 * Build an OAuth2Client. `redirectUri` is mandatory because Google compares it
 * to whatever the user came back from.
 */
export function getOAuth2Client(redirectUri: string): OAuth2Client {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET missing in env');
  }
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

/**
 * Builds the URL we send the user to in order to start the OAuth dance.
 * - `prompt: 'consent'` forces Google to emit a refresh_token even if the user
 *   has authorized us before (otherwise the refresh_token only comes the FIRST
 *   time and we'd be locked out after a disconnect).
 * - `access_type: 'offline'` is what asks for the refresh_token at all.
 */
export function getAuthorizeUrl(redirectUri: string, state?: string): string {
  const client = getOAuth2Client(redirectUri);
  return client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: GOOGLE_SCOPES,
    include_granted_scopes: true,
    state,
  });
}

/**
 * Exchange the `code` Google sent back for tokens, look up the email the user
 * authorized as, and persist (or refresh) the row.
 *
 * Returns the email so the caller can show "connected as X" to the user.
 */
export async function exchangeCodeAndStore(
  code: string,
  redirectUri: string,
): Promise<string> {
  const client = getOAuth2Client(redirectUri);
  const { tokens } = await client.getToken(code);

  if (!tokens.refresh_token) {
    throw new Error(
      'Google did not return a refresh_token. Most likely cause: this account already authorized the app and Google reused the prior grant. Revoke at https://myaccount.google.com/permissions and reconnect.',
    );
  }
  if (!tokens.access_token || !tokens.expiry_date) {
    throw new Error('Google did not return a usable access_token.');
  }

  client.setCredentials(tokens);
  const oauth2 = google.oauth2({ auth: client, version: 'v2' });
  const me = await oauth2.userinfo.get();
  const email = me.data.email;
  if (!email) {
    throw new Error('Google did not return an email for the authorizer.');
  }

  const expiresAt = new Date(tokens.expiry_date);
  const scope = tokens.scope ?? GOOGLE_SCOPES.join(' ');

  // Upsert. If a row exists (even if previously disconnected) we revive it.
  const existing = await db
    .select({ id: googleIntegrations.id })
    .from(googleIntegrations)
    .where(eq(googleIntegrations.email, email))
    .limit(1);

  if (existing[0]) {
    await db
      .update(googleIntegrations)
      .set({
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        scope,
        tokenType: tokens.token_type ?? 'Bearer',
        expiresAt,
        lastRefreshedAt: new Date(),
        lastError: null,
        disconnectedAt: null,
        updatedAt: new Date(),
      })
      .where(eq(googleIntegrations.id, existing[0].id));
  } else {
    await db.insert(googleIntegrations).values({
      email,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      scope,
      tokenType: tokens.token_type ?? 'Bearer',
      expiresAt,
      connectedAt: new Date(),
      lastRefreshedAt: new Date(),
    });
  }

  return email;
}

/**
 * Get an authenticated OAuth2Client for `email`, refreshing the access_token
 * if it expires within 60 seconds. Throws if no integration exists or the
 * refresh fails.
 */
export async function getAuthedClient(
  email: string,
  redirectUri?: string,
): Promise<OAuth2Client> {
  const [row] = await db
    .select()
    .from(googleIntegrations)
    .where(
      and(
        eq(googleIntegrations.email, email),
        isNull(googleIntegrations.disconnectedAt),
      ),
    )
    .limit(1);

  if (!row) throw new Error(`No active Google integration for ${email}`);

  const client = getOAuth2Client(
    redirectUri ?? defaultRedirectUri(),
  );
  client.setCredentials({
    access_token: row.accessToken,
    refresh_token: row.refreshToken,
    expiry_date: new Date(row.expiresAt).getTime(),
    scope: row.scope,
    token_type: row.tokenType,
  });

  // Refresh proactively if <60s left.
  const msLeft = new Date(row.expiresAt).getTime() - Date.now();
  if (msLeft < 60_000) {
    try {
      const { credentials } = await client.refreshAccessToken();
      if (credentials.access_token && credentials.expiry_date) {
        await db
          .update(googleIntegrations)
          .set({
            accessToken: credentials.access_token,
            expiresAt: new Date(credentials.expiry_date),
            lastRefreshedAt: new Date(),
            lastError: null,
            updatedAt: new Date(),
          })
          .where(eq(googleIntegrations.id, row.id));
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await db
        .update(googleIntegrations)
        .set({ lastError: msg, updatedAt: new Date() })
        .where(eq(googleIntegrations.id, row.id));
      throw new Error(`Refresh failed for ${email}: ${msg}`);
    }
  }

  return client;
}

/**
 * Default redirect URI for the running env. Vercel exposes the deployment URL
 * via VERCEL_URL; locally we fall back to localhost:3000.
 */
export function defaultRedirectUri(): string {
  const url =
    process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ??
    'http://localhost:3000';
  return `${url}/api/auth/google/callback`;
}

/**
 * Convenience getters for ready-to-use API clients.
 */
export async function getGmailClient(email: string, redirectUri?: string) {
  const auth = await getAuthedClient(email, redirectUri);
  return google.gmail({ version: 'v1', auth });
}
export async function getDriveClient(email: string, redirectUri?: string) {
  const auth = await getAuthedClient(email, redirectUri);
  return google.drive({ version: 'v3', auth });
}
export async function getCalendarClient(email: string, redirectUri?: string) {
  const auth = await getAuthedClient(email, redirectUri);
  return google.calendar({ version: 'v3', auth });
}
