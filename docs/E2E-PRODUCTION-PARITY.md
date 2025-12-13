# E2E Testing vs Production: Parity Analysis

> **Honest assessment of what IS and what ISN'T identical between local E2E tests and production.**

## Executive Summary

**Can you treat local E2E as 100% identical to production? No.**

However, the E2E environment catches **approximately 85-90% of potential bugs** before deployment. This document explains exactly what gaps exist so you can make informed decisions.

---

## What IS Tested Identically

| Component | Local E2E | Production | Parity |
|-----------|-----------|------------|--------|
| Application code | Same `src/index.ts` | Same | ✅ 100% |
| Hono routes | Same routing logic | Same | ✅ 100% |
| Session management | Same `lib/session.ts` | Same | ✅ 100% |
| KV API surface | Wrangler local mode | Cloudflare KV | ✅ 99% |
| Rate limiting logic | Same in-memory map | Same | ✅ 100% |
| Frontend JS/CSS/HTML | Same assets | Same | ✅ 100% |
| OAuth flow logic | Same code paths | Same | ✅ 100% |
| Genre aggregation | Same algorithms | Same | ✅ 100% |
| Playlist creation | Same API calls | Same | ✅ 100% |
| Error handling | Same try/catch logic | Same | ✅ 100% |

---

## What IS NOT Tested Identically

### Critical Gaps (Could Cause Production Failures)

#### 1. Cloudflare Workers 50 Subrequest Limit
**Severity: HIGH**

- **Production**: Cloudflare enforces 50 subrequests per invocation (free plan)
- **Local**: No limit enforced by wrangler dev

**Impact**: A library scan making 51+ external API calls will SUCCEED locally but FAIL in production.

**Current Mitigation**: Code limits tracks to 1000 (20 requests × 50 tracks) - see `src/lib/spotify.ts:190-197`

**Gap**: If someone modifies these limits, local tests won't catch the violation.

#### 2. CPU Time Limit
**Severity: MEDIUM**

- **Production**: 10ms CPU time (free) or 30s wall-clock (paid)
- **Local**: Unlimited

**Impact**: Long-running synchronous operations succeed locally, fail in production.

#### 3. Memory Limit
**Severity: MEDIUM**

- **Production**: 128MB memory limit
- **Local**: Node.js default (2GB+)

**Impact**: Memory-intensive operations on large libraries succeed locally, fail in production.

#### 4. Real Spotify API Not Called
**Severity: HIGH**

MSW (Mock Service Worker) intercepts ALL requests to `api.spotify.com`:
- Token expiry is never tested (mocks always return valid tokens)
- Real Spotify rate limits (429) are simulated but timing is artificial
- Spotify API changes/outages are not detected
- Real OAuth redirect flows are not tested

**What's Mocked**:
- `/v1/me` - User profile
- `/v1/me/tracks` - Liked songs
- `/v1/artists` - Artist details
- `/v1/me/player` - Now playing
- `/v1/users/:id/playlists` - Playlist creation
- `/v1/playlists/:id/tracks` - Add tracks to playlist

#### 5. KV Performance Characteristics
**Severity: LOW**

- **Production**: Globally distributed, ~50ms latency, eventual consistency
- **Local**: File-based, instant, always consistent

**Impact**: Race conditions or timing-sensitive code may work locally but fail in production.

#### 6. No Edge Caching
**Severity: LOW**

- **Production**: Cloudflare caches responses at edge based on headers
- **Local**: No caching layer

**Impact**: Cache-related bugs (stale data, cache invalidation) not detected.

---

## Risk Matrix

| Scenario | Local Behaviour | Production Behaviour | Risk Level |
|----------|-----------------|---------------------|-------------|
| User with 2000+ tracks | Works (mocked) | May hit subrequest limit | 🔴 HIGH |
| Expired Spotify token | Mock returns valid | 401 error, needs refresh | 🟡 MEDIUM |
| Spotify API down | Mock returns data | Real failure | 🔴 HIGH |
| Slow network | Instant response | 2-5 second latency | 🟡 MEDIUM |
| Memory-heavy operation | Works | May OOM | 🟡 MEDIUM |
| Cache invalidation | Immediate | Edge propagation delay | 🟢 LOW |

---

## How to Achieve Higher Parity

### Option 1: Integration Test Layer (Recommended)
Add a separate test suite that hits REAL Spotify API with a test account:

```typescript
// tests/integration/real-spotify.test.ts
// Runs against real Spotify API (rate-limited, CI-only)
```

**Pros**: Tests real API behaviour, token refresh, rate limits
**Cons**: Slow, requires Spotify test account, can hit rate limits

### Option 2: Subrequest Counter Middleware
Add instrumentation to count subrequests in wrangler dev:

```typescript
// src/middleware/subrequest-counter.ts
let subrequestCount = 0;
const MAX_SUBREQUESTS = 50;

export function trackSubrequest() {
  subrequestCount++;
  if (process.env.E2E_TEST_MODE && subrequestCount > MAX_SUBREQUESTS) {
    throw new Error(`Subrequest limit exceeded: ${subrequestCount}/50`);
  }
}
```

### Option 3: Chaos Testing
Randomly inject failures in mocks to simulate production issues:
- 5% chance of 429 rate limit
- 2% chance of 500 server error
- Random latency injection (100-3000ms)

---

## Recommended Testing Strategy

### Level 1: E2E Tests (Current)
- Fast, no external dependencies
- Catches 85-90% of bugs
- **Run on every commit**

### Level 2: Integration Tests (Add These)
- Real Spotify API with test account
- Slow, rate-limited
- **Run daily or on release branches**

### Level 3: Production Smoke Tests
- Hit production endpoints after deploy
- Verify critical flows work
- **Run after every deployment**

### Level 4: Canary Deployments
- Deploy to 10% of traffic first
- Monitor error rates
- Roll back automatically on spike

---

## What the Current E2E Tests DO Catch

1. ✅ Broken routes returning 404/500
2. ✅ Missing session handling
3. ✅ Frontend JavaScript errors
4. ✅ CSS layout issues
5. ✅ OAuth flow logic errors
6. ✅ Genre aggregation bugs
7. ✅ Playlist creation logic errors
8. ✅ Rate limiting logic (app-side)
9. ✅ KV read/write operations
10. ✅ UI state management
11. ✅ Swedish mode Easter eggs
12. ✅ Theme toggle functionality
13. ✅ Leaderboard/scoreboard display
14. ✅ Progressive scan state machine

## What the Current E2E Tests DO NOT Catch

1. ❌ Cloudflare subrequest limit violations
2. ❌ Real Spotify API changes/deprecations
3. ❌ Token expiry and refresh edge cases
4. ❌ Production network latency issues
5. ❌ Memory exhaustion on large libraries
6. ❌ Edge cache invalidation bugs
7. ❌ Cloudflare Workers cold start behaviour
8. ❌ Real OAuth redirect flow issues
9. ❌ Production DNS/SSL issues
10. ❌ BetterStack logging integration

---

## Conclusion

The E2E test environment provides **high confidence** for catching application logic bugs but **cannot guarantee** production parity for infrastructure-level constraints.

**Recommended approach**:
1. Run E2E tests on every commit (fast feedback)
2. Add integration tests with real Spotify API (run daily)
3. Add production smoke tests after deployment
4. Consider canary deployments for high-risk changes

The goal is not 100% parity (impossible) but **layered testing** that catches bugs at appropriate stages.
