# ISSUE-005: Embedded Base64 Assets in Main Bundle

## Metadata
| Field | Value |
|-------|-------|
| ID | ISSUE-005 |
| Severity | 🟡 Medium |
| Category | Performance / Bundle Size |
| Phase Found | 3 |
| Status | 🔴 Open |
| Assigned | - |
| Created | 2025-12-20T07:30:00+11:00 |
| Updated | 2025-12-20T07:30:00+11:00 |

## Description
The main `index.ts` file contains ~284KB of base64-encoded media assets embedded directly in the source code. This increases the worker bundle size and may impact cold start times.

## Location
- **File(s):** `src/index.ts:103, 523`
- **Variables:**
  - `INTRO_VIDEO_B64` (line 103) - 271KB base64 video
  - Unnamed base64 image (line 523) - 13KB

## Evidence
```typescript
// Line 103 - 271KB video
const INTRO_VIDEO_B64 = 'AAAAIGZ0eXBpc29tAAA...'; // 271,067 characters

// Line 523 - 13KB image
const base64 = 'iVBORw0KGgoAAAANSUhEUgAA...'; // 13,447 characters
```

## Impact
- **Worker Size:** Adds ~284KB to the compiled worker bundle
- **Cold Start:** May increase cold start latency on first request
- **Maintenance:** Binary data in source code is harder to update
- **Build Time:** Larger files take longer to transpile

## Remediation

### Instructions
1. Extract base64 assets to separate files
2. Host on Cloudflare R2 or Pages static assets
3. Fetch dynamically or serve directly from CDN
4. Remove from index.ts

### Example Fix
Option A: Move to R2 bucket
```typescript
// Instead of embedding
const videoUrl = 'https://assets.genres.lovesit.au/intro-video.mp4';

// Serve via CDN instead of embedding
app.get('/intro-video', async (c) => {
  return c.redirect(videoUrl);
});
```

Option B: Use Cloudflare Pages static assets
```typescript
// Reference static asset
const INTRO_VIDEO_URL = '/assets/intro-video.mp4';
```

### Verification
1. Deploy without embedded assets
2. Verify video/image still loads correctly
3. Compare cold start times before/after
4. Check bundle size reduction

## References
- [Cloudflare Workers Limits](https://developers.cloudflare.com/workers/platform/limits/)
- [Cloudflare R2](https://developers.cloudflare.com/r2/)

## Resolution
| Field | Value |
|-------|-------|
| Fixed By | - |
| Fixed Date | - |
| Commit | - |
| Verified | - |
