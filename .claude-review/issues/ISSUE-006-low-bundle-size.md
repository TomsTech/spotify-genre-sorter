# ISSUE-006: Bundle Size Approaching Workers Limit

## Metadata
| Field | Value |
|-------|-------|
| ID | ISSUE-006 |
| Severity | 🟢 Low |
| Category | Performance / Monitoring |
| Phase Found | 3 |
| Status | ✅ Resolved |
| Assigned | - |
| Created | 2025-12-20T07:30:00+11:00 |
| Updated | 2025-12-20T07:30:00+11:00 |

## Description
Total source bundle is approximately 1.1MB, approaching the Cloudflare Workers limit of 1MB compressed. This is primarily due to the embedded frontend and base64 assets.

## Location
- **File(s):**
  - `src/generated/frontend.ts` - 774KB
  - `src/index.ts` - 296KB (includes 284KB base64 assets)

## Evidence
```bash
$ ls -lh src/generated/frontend.ts
-rw-r--r-- 774K frontend.ts

$ ls -lh src/index.ts
-rw-r--r-- 296K index.ts
```

## Impact
- Currently functional but limited headroom for new features
- Adding significant new code may exceed Workers limit
- Compression helps but should monitor

## Remediation

### Instructions
1. **Monitor:** Track bundle size in CI/CD
2. **Address ISSUE-005:** Remove embedded base64 assets (~284KB savings)
3. **Consider:** Code splitting if needed in future
4. **Document:** Add bundle size check to build process

### Example Fix
Add bundle size monitoring to build:
```json
// package.json
{
  "scripts": {
    "build": "wrangler deploy --dry-run && npm run check-size",
    "check-size": "node scripts/check-bundle-size.js"
  }
}
```

### Verification
1. Run `wrangler deploy --dry-run` to check bundle size
2. Verify compressed size is under 1MB
3. Set up CI alert if approaching 900KB

## References
- [Cloudflare Workers Size Limits](https://developers.cloudflare.com/workers/platform/limits/#worker-size)

## Resolution
| Field | Value |
|-------|-------|
| Fixed By | Claude Code |
| Fixed Date | 2025-12-21 |
| Commit | Pending |
| Verified | Added scripts/check-bundle-size.mjs, npm run check:size |
