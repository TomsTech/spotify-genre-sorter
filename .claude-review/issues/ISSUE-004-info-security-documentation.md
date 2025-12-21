# ISSUE-004: Security Controls Not Documented

## Metadata
| Field | Value |
|-------|-------|
| ID | ISSUE-004 |
| Severity | ℹ️ Informational |
| Category | Documentation |
| Phase Found | 2 |
| Status | ✅ Resolved |
| Assigned | - |
| Created | 2025-12-20T07:20:00+11:00 |
| Updated | 2025-12-20T07:20:00+11:00 |

## Description
The application has excellent security controls implemented (CSRF, rate limiting, PKCE OAuth, CSP nonces) but these are not documented in a SECURITY.md or README section.

## Location
- **File(s):** Project root (missing SECURITY.md)

## Evidence
Security features implemented but undocumented:
- CSRF with timing-safe comparison (`src/lib/csrf.ts`)
- Rate limiting with bounded memory (`src/routes/api.ts`)
- PKCE OAuth flow (`src/lib/spotify.ts`)
- CSP nonces (`src/lib/csp-nonce.ts`)
- HTTP-only secure cookies (`src/lib/session.ts`)

## Impact
- Contributors may not understand security measures
- Security researchers cannot easily verify controls
- Onboarding difficulty for new maintainers

## Remediation

### Instructions
1. Create `SECURITY.md` in project root
2. Document all security controls
3. Add security contact information
4. Include responsible disclosure policy

### Example Fix
Create `SECURITY.md`:
```markdown
# Security

## Security Controls

### Authentication
- OAuth 2.0 with PKCE for Spotify
- GitHub OAuth with allowlist

### Session Security
- HTTP-only, Secure, SameSite=Lax cookies
- 7-day session expiration

### CSRF Protection
- Double-submit cookie pattern
- Timing-safe token comparison

### Rate Limiting
- 30 requests/minute per IP
- Bounded memory with automatic cleanup

### Content Security
- CSP nonces for inline scripts
- Strict CSP headers

## Reporting Security Issues
Please report security vulnerabilities to: [email]
```

### Verification
1. Verify SECURITY.md is created
2. Review for accuracy against implementation

## References
- [GitHub Security Policy](https://docs.github.com/en/code-security/getting-started/adding-a-security-policy-to-your-repository)

## Resolution
| Field | Value |
|-------|-------|
| Fixed By | Claude Code |
| Fixed Date | 2025-12-21 |
| Commit | Pending |
| Verified | Created SECURITY.md |
