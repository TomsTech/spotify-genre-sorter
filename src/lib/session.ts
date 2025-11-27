import { Context } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';

export interface Session {
  githubUser: string;
  githubAvatar?: string;
  spotifyAccessToken?: string;
  spotifyRefreshToken?: string;
  spotifyExpiresAt?: number;
}

const SESSION_COOKIE = 'session_id';
const SESSION_TTL = 60 * 60 * 24 * 7; // 7 days

export async function createSession(
  c: Context<{ Bindings: Env }>,
  session: Session
): Promise<string> {
  const sessionId = crypto.randomUUID();
  await c.env.SESSIONS.put(
    `session:${sessionId}`,
    JSON.stringify(session),
    { expirationTtl: SESSION_TTL }
  );

  setCookie(c, SESSION_COOKIE, sessionId, {
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
    maxAge: SESSION_TTL,
    path: '/',
  });

  return sessionId;
}

export async function getSession(
  c: Context<{ Bindings: Env }>
): Promise<Session | null> {
  const sessionId = getCookie(c, SESSION_COOKIE);
  if (!sessionId) return null;

  const data = await c.env.SESSIONS.get(`session:${sessionId}`);
  if (!data) return null;

  return JSON.parse(data) as Session;
}

export async function updateSession(
  c: Context<{ Bindings: Env }>,
  updates: Partial<Session>
): Promise<void> {
  const sessionId = getCookie(c, SESSION_COOKIE);
  if (!sessionId) return;

  const existing = await getSession(c);
  if (!existing) return;

  const updated = { ...existing, ...updates };
  await c.env.SESSIONS.put(
    `session:${sessionId}`,
    JSON.stringify(updated),
    { expirationTtl: SESSION_TTL }
  );
}

export async function deleteSession(
  c: Context<{ Bindings: Env }>
): Promise<void> {
  const sessionId = getCookie(c, SESSION_COOKIE);
  if (sessionId) {
    await c.env.SESSIONS.delete(`session:${sessionId}`);
  }
  deleteCookie(c, SESSION_COOKIE, { path: '/' });
}

export function generateState(): string {
  return crypto.randomUUID();
}

export async function storeState(
  kv: KVNamespace,
  state: string,
  data: Record<string, string>
): Promise<void> {
  await kv.put(`state:${state}`, JSON.stringify(data), { expirationTtl: 600 });
}

export async function verifyState(
  kv: KVNamespace,
  state: string
): Promise<Record<string, string> | null> {
  const data = await kv.get(`state:${state}`);
  if (!data) return null;
  await kv.delete(`state:${state}`);
  return JSON.parse(data);
}
