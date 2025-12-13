# Pre-Deployment Checklist

Use this checklist before every production deployment to catch issues that E2E tests cannot detect.

---

## Before Merge/Deploy

### Code Review
- [ ] No hardcoded API limits removed (check `MAX_TRACK_REQUESTS`, `MAX_TRACKS_FREE_TIER`)
- [ ] No new unbounded loops that could exceed 50 subrequests
- [ ] Token refresh logic not modified without testing real expiry
- [ ] No synchronous heavy computation added (CPU time limit)
- [ ] Memory usage considered for large libraries (128MB limit)

### E2E Tests
- [ ] All E2E tests pass: `npm run test:e2e`
- [ ] TypeScript compiles: `npm run typecheck`
- [ ] Lint passes: `npm run lint`
- [ ] Unit tests pass: `npm test`

### Manual Verification (Critical Changes Only)
- [ ] Test with real Spotify account if OAuth flow changed
- [ ] Test with 1000+ track library if scan logic changed
- [ ] Verify progressive scan works for large libraries

---

## After Deployment

### Production Smoke Tests
```bash
# Health check
curl https://genre-genie.com/health

# Session check (should return valid JSON)
curl https://genre-genie.com/session

# Leaderboard (should return data)
curl https://genre-genie.com/api/leaderboard

# KV metrics (should return usage data)
curl https://genre-genie.com/api/kv-usage
```

### Verify Core Flows
- [ ] Homepage loads without console errors
- [ ] Login with Spotify redirects correctly
- [ ] Genre list displays after auth
- [ ] Playlist creation works for at least one genre
- [ ] Leaderboard/scoreboard display correctly

### Monitor for 30 Minutes
- [ ] Check BetterStack for error spikes
- [ ] Check Cloudflare Analytics for 5xx errors
- [ ] Verify KV usage not spiking abnormally

---

## Known Limitations (Cannot Be Pre-Tested)

| Issue | Detection Method | Response |
|-------|------------------|----------|
| Subrequest limit hit | User reports / BetterStack errors | Reduce batch sizes |
| Spotify API changes | User reports / 4xx errors | Update API calls |
| Token refresh failure | User reports / auth failures | Check OAuth config |
| Memory exhaustion | Cloudflare dashboard / timeouts | Optimize memory usage |
| Edge cache stale | User reports | Purge cache manually |

---

## Quick Rollback Commands

```bash
# View recent deployments
npx wrangler deployments list

# Rollback to previous version
npx wrangler rollback

# Rollback to specific deployment
npx wrangler rollback <deployment-id>
```

---

## Emergency Contacts

- **Cloudflare Status**: https://www.cloudflarestatus.com/
- **Spotify API Status**: https://developer.spotify.com/community/
- **BetterStack Dashboard**: https://uptime.betterstack.com/
