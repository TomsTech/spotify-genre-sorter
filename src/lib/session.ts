import { Context } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';

export interface Session {
  githubUser?: string;
  githubAvatar?: string;
  spotifyUser?: string;
  spotifyUserId?: string;
  spotifyAvatar?: string;
  spotifyAccessToken?: string;
  spotifyRefreshToken?: string;
  spotifyExpiresAt?: number;
}

const SESSION_COOKIE = 'session_id';
const SESSION_TTL = 60 * 60 * 24 * 7; // 7 days

export async function createSession(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  c: Context<{ Bindings: Env }, any, any>,
  session: Session
): Promise<string> {
  const sessionId = crypto.randomUUID();
  await c.env.SESSIONS.put(
    `session:${sessionId}`,
    JSON.stringify(session),
    { expirationTtl: SESSION_TTL }
  );

  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  c: Context<{ Bindings: Env }, any, any>
): Promise<Session | null> {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  const sessionId = getCookie(c, SESSION_COOKIE);
  if (!sessionId) return null;

  const data = await c.env.SESSIONS.get(`session:${sessionId}`);
  if (!data) return null;

  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const session: Session = JSON.parse(data);
  return session;
}

export async function updateSession(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  c: Context<{ Bindings: Env }, any, any>,
  updates: Partial<Session>
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  c: Context<{ Bindings: Env }, any, any>
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  const sessionId = getCookie(c, SESSION_COOKIE);
  if (sessionId) {
    await c.env.SESSIONS.delete(`session:${sessionId}`);
  }
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
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
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const parsed: Record<string, string> = JSON.parse(data);
  return parsed;
}
