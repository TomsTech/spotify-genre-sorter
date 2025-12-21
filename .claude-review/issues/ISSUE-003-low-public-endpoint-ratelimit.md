# ISSUE-003: Public Endpoints Without Rate Limiting

## Metadata
| Field | Value |
|-------|-------|
| ID | ISSUE-003 |
| Severity | 🟢 Low |
| Category | Security / Rate Limiting |
| Phase Found | 2 |
| Status | 🔴 Open |
| Assigned | - |
| Created | 2025-12-20T07:20:00+11:00 |
| Updated | 2025-12-20T07:20:00+11:00 |

## Description
Public endpoints (`/api/scoreboard`, `/api/leaderboard`, `/api/analytics`, etc.) bypass the authentication middleware but are still covered by rate limiting. However, they expose aggregated user data that could be enumerated.

## Location
- **File(s):** `src/routes/api.ts:131-132`
- **Function/Class:** PUBLIC_ENDPOINTS array

## Evidence
```typescript
// Public endpoints that don't require authentication
const PUBLIC_ENDPOINTS = ['/scoreboard', '/leaderboard', '/recent-playlists',
  '/deploy-status', '/changelog', '/analytics', '/kv-usage', '/kv-metrics',
  '/log-error', '/log-perf', '/listening'];
```

## Impact
- Scoreboard/leaderboard data could be scraped
- Analytics endpoint exposes usage patterns
- Low risk: data is intentionally public and aggregated, no PII exposed

## Remediation

### Instructions
1. **Review:** Confirm all public endpoints only expose intended data
2. **Optional:** Add stricter rate limits for unauthenticated requests
3. **Document:** Add comments explaining why each endpoint is public

### Example Fix
```typescript
// Optional: Stricter rate limit for public endpoints
const PUBLIC_RATE_LIMIT = 10; // 10 requests per minute for unauthenticated

api.use('/*', async (c, next) => {
  const path = new URL(c.req.url).pathname.replace('/api', '');
  const isPublic = PUBLIC_ENDPOINTS.includes(path);
  const limit = isPublic ? PUBLIC_RATE_LIMIT : RATE_LIMIT_MAX_REQUESTS;
  // ... rate limiting logic with adjusted limit
});
```

### Verification
1. Review each public endpoint for data exposure
2. Confirm no PII is returned
3. Test rate limiting still applies

## References
- [API Security Best Practices](https://owasp.org/www-project-api-security/)

## Resolution
| Field | Value |
|-------|-------|
| Fixed By | - |
| Fixed Date | - |
| Commit | - |
| Verified | - |
