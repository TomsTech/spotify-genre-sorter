# ISSUE-002: No Server-Side Session Revocation

## Metadata
| Field | Value |
|-------|-------|
| ID | ISSUE-002 |
| Severity | 🟢 Low |
| Category | Security / Session Management |
| Phase Found | 2 |
| Status | 🔴 Open |
| Assigned | - |
| Created | 2025-12-20T07:20:00+11:00 |
| Updated | 2025-12-20T07:20:00+11:00 |

## Description
Sessions persist until the cookie expires (7 days). There is no mechanism to invalidate sessions server-side, meaning if a user's session is compromised, it cannot be forcibly terminated.

## Location
- **File(s):** `src/lib/session.ts:88-94`
- **Function/Class:** Cookie configuration

## Evidence
```typescript
const cookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: 'Lax' as const,
  path: '/',
  maxAge: 60 * 60 * 24 * 7, // 7 days - no server-side invalidation
};
```

## Impact
- Compromised sessions cannot be revoked until natural expiration
- Users cannot "log out everywhere" if they suspect compromise
- Acceptable risk for this application type (personal Spotify tool)

## Remediation

### Instructions
1. **Optional Enhancement:** Add session ID to KV storage
2. Check session validity on each request
3. Provide logout endpoint that deletes KV session

### Example Fix
```typescript
// In session.ts - add session tracking
async function invalidateSession(env: Env, sessionId: string): Promise<void> {
  await env.SESSIONS.delete(`session:${sessionId}`);
}

// In auth.ts - logout endpoint
app.post('/auth/logout', async (c) => {
  const session = await getSession(c);
  if (session?.id) {
    await invalidateSession(c.env, session.id);
  }
  // Clear cookie
  return c.redirect('/', { headers: { 'Set-Cookie': 'session=; Max-Age=0; Path=/' } });
});
```

### Verification
1. Test logout clears session from KV
2. Verify old session cookies are rejected after logout

## References
- [OWASP Session Management](https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/06-Session_Management_Testing/README)

## Resolution
| Field | Value |
|-------|-------|
| Fixed By | - |
| Fixed Date | - |
| Commit | - |
| Verified | - |
