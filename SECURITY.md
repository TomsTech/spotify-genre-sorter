# Security

This document outlines the security controls implemented in the Spotify Genre Sorter application.

## Authentication

### OAuth 2.0 with PKCE
- **Spotify OAuth**: Uses PKCE (Proof Key for Code Exchange) flow for enhanced security
- **GitHub OAuth**: Optional allowlist-based authentication for admin access
- **State Parameter**: Cryptographically random state tokens prevent CSRF in OAuth flows

### Session Security
- **HTTP-only Cookies**: Session tokens cannot be accessed via JavaScript
- **Secure Flag**: Cookies only transmitted over HTTPS
- **SameSite=Lax**: Mitigates CSRF attacks while allowing normal navigation
- **7-day Expiration**: Sessions automatically expire

## CSRF Protection

- **Double-Submit Cookie Pattern**: CSRF tokens validated on state-changing requests
- **Timing-Safe Comparison**: Token validation uses constant-time comparison to prevent timing attacks
- **Cryptographic Tokens**: Generated using `crypto.getRandomValues()`

## Rate Limiting

- **30 requests/minute per IP**: Prevents abuse and brute-force attacks
- **Bounded Memory**: Rate limiter uses deterministic cleanup to prevent memory exhaustion
- **Automatic Cleanup**: Expired entries removed on a rolling basis

## Content Security

- **CSP Nonces**: Inline scripts require cryptographic nonces
- **Strict CSP Headers**: Prevents XSS and injection attacks
- **Input Validation**: Spotify IDs validated via regex patterns

## API Security

- **Authenticated Endpoints**: Most API endpoints require valid session
- **Public Endpoints**: Scoreboard, leaderboard, and analytics are intentionally public (read-only)
- **Error Sanitization**: Error messages do not expose internal details or stack traces

## Infrastructure

- **Cloudflare Workers**: Edge deployment with built-in DDoS protection
- **Cloudflare KV**: Encrypted-at-rest session storage
- **HTTPS Only**: All traffic encrypted in transit

## Reporting Security Issues

If you discover a security vulnerability, please report it responsibly:

1. **Do not** open a public issue
2. Email the maintainer directly (see repository contact)
3. Include steps to reproduce the vulnerability
4. Allow reasonable time for a fix before public disclosure

## Security Audit

Last audited: 2025-12-20

| Control | Status |
|---------|--------|
| CSRF Protection | Implemented |
| Rate Limiting | Implemented |
| OAuth PKCE | Implemented |
| Secure Cookies | Implemented |
| CSP Nonces | Implemented |
| Input Validation | Implemented |
