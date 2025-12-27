# BetterStack Monitoring Guide

## Overview

This guide covers setting up comprehensive monitoring for Spotify Genre Genie using [BetterStack](https://betterstack.com) (formerly Better Uptime). BetterStack provides uptime monitoring, incident management, and status pages in a single platform.

### Why BetterStack?

| Feature | Benefit |
|---------|---------|
| **10 Free Monitors** | Sufficient for complete endpoint coverage |
| **Multi-Region Checks** | Sydney (ap-southeast) primary, global secondary |
| **Status Pages** | Public incident communication |
| **Incident Management** | Built-in escalation and on-call |
| **Integrations** | Slack, Discord, email, webhooks |

### What We Monitor

| Category | Endpoints | Purpose |
|----------|-----------|---------|
| **Health** | `/health` | Core application status |
| **API** | `/api/stats`, `/api/leaderboard`, `/api/session` | API availability |
| **Infrastructure** | SSL, DNS | Certificate and resolution |
| **Auth Flow** | `/auth/spotify`, `/setup` | OAuth functionality |

---

## Monitor Configuration

### Free Tier Allocation (10 Monitors)

BetterStack's free tier includes 10 HTTP monitors with keyword matching. Here's the optimal allocation:

| # | Monitor Name | Priority | Public |
|---|--------------|----------|--------|
| 1 | Health Check | Critical | Yes |
| 2 | Application | Critical | Yes |
| 3 | Stats API | High | Yes |
| 4 | Leaderboard API | High | Yes |
| 5 | Session Check | High | No |
| 6 | Configuration | Medium | No |
| 7 | SSL Certificate | Critical | Yes |
| 8 | DNS Resolution | Critical | Yes |
| 9 | Auth Redirect | Medium | No |
| 10 | Response Time | High | Yes |

---

### Monitor 1: Health Check (Critical)

Primary health endpoint - the heartbeat of the application.

| Field | Value |
|-------|-------|
| **Name** | `Genre Genie - Health` |
| **URL** | `https://spotify.houstons.tech/health` |
| **Method** | GET |
| **Check Interval** | 1 minute |
| **Timeout** | 10 seconds |
| **Expected Status** | 200 |
| **Keyword** | `"status":"ok"` |
| **Regions** | Sydney (primary), US-East, EU-West |
| **Confirm After** | 3 failures |

**Expected Response:**
```json
{
  "status": "ok",
  "version": "3.4.0"
}
```

**Detailed Health Check:**
```bash
curl -s "https://spotify.houstons.tech/health?detailed=true" | jq
```

```json
{
  "status": "ok",
  "version": "3.4.0",
  "components": {
    "kv": { "status": "ok", "latency": 12 },
    "secrets": { "status": "ok" }
  },
  "timestamp": "2025-12-27T10:30:00.000Z"
}
```

---

### Monitor 2: Application (Critical)

Verifies the main application loads correctly.

| Field | Value |
|-------|-------|
| **Name** | `Genre Genie - Application` |
| **URL** | `https://spotify.houstons.tech/` |
| **Method** | GET |
| **Check Interval** | 2 minutes |
| **Timeout** | 15 seconds |
| **Expected Status** | 200 |
| **Keyword** | `Genre Genie` |
| **Regions** | Sydney, US-East |
| **Confirm After** | 2 failures |

---

### Monitor 3: Stats API (High)

Validates the statistics endpoint and KV connectivity.

| Field | Value |
|-------|-------|
| **Name** | `Genre Genie - Stats API` |
| **URL** | `https://spotify.houstons.tech/api/stats` |
| **Method** | GET |
| **Check Interval** | 5 minutes |
| **Timeout** | 10 seconds |
| **Expected Status** | 200 |
| **Keyword** | `"userCount"` |
| **Regions** | Sydney |
| **Confirm After** | 3 failures |

**Expected Response:**
```json
{
  "userCount": 42,
  "playlistCount": 156,
  "lastUpdated": "2025-12-27T10:00:00.000Z"
}
```

---

### Monitor 4: Leaderboard API (High)

Verifies the leaderboard/Hall of Fame functionality.

| Field | Value |
|-------|-------|
| **Name** | `Genre Genie - Leaderboard` |
| **URL** | `https://spotify.houstons.tech/api/leaderboard` |
| **Method** | GET |
| **Check Interval** | 5 minutes |
| **Timeout** | 10 seconds |
| **Expected Status** | 200 |
| **Keyword** | `"entries"` or `[]` |
| **Regions** | Sydney |
| **Confirm After** | 3 failures |

---

### Monitor 5: Session Check (High)

Validates session system returns expected unauthenticated response.

| Field | Value |
|-------|-------|
| **Name** | `Genre Genie - Session` |
| **URL** | `https://spotify.houstons.tech/api/session` |
| **Method** | GET |
| **Check Interval** | 5 minutes |
| **Timeout** | 10 seconds |
| **Expected Status** | 200 |
| **Keyword** | `"authenticated"` |
| **Regions** | Sydney |
| **Confirm After** | 3 failures |

**Expected Response (unauthenticated):**
```json
{
  "authenticated": false
}
```

---

### Monitor 6: Configuration (Medium)

Verifies Spotify credentials are properly configured.

| Field | Value |
|-------|-------|
| **Name** | `Genre Genie - Config` |
| **URL** | `https://spotify.houstons.tech/setup` |
| **Method** | GET |
| **Check Interval** | 15 minutes |
| **Timeout** | 10 seconds |
| **Expected Status** | 200 |
| **Keyword** | `"configured":true` |
| **Regions** | Sydney |
| **Confirm After** | 2 failures |

**Expected Response:**
```json
{
  "configured": true,
  "mode": "spotify-only"
}
```

---

### Monitor 7: SSL Certificate (Critical)

Monitors SSL certificate expiry and validity.

| Field | Value |
|-------|-------|
| **Name** | `Genre Genie - SSL` |
| **URL** | `https://spotify.houstons.tech/health` |
| **Monitor Type** | SSL Certificate |
| **Check Interval** | 6 hours |
| **Alert When** | < 30 days until expiry |
| **Critical When** | < 7 days until expiry |

> **Note:** Cloudflare manages SSL certificates automatically with 90-day renewal. This monitor provides early warning if automatic renewal fails.

---

### Monitor 8: DNS Resolution (Critical)

Ensures DNS resolves correctly to Cloudflare.

| Field | Value |
|-------|-------|
| **Name** | `Genre Genie - DNS` |
| **Hostname** | `spotify.houstons.tech` |
| **Monitor Type** | DNS |
| **Check Interval** | 5 minutes |
| **Expected** | Resolves to Cloudflare IPs |
| **Regions** | Global (multiple) |

---

### Monitor 9: Auth Redirect (Medium)

Verifies OAuth flow initiates correctly.

| Field | Value |
|-------|-------|
| **Name** | `Genre Genie - Auth` |
| **URL** | `https://spotify.houstons.tech/auth/spotify` |
| **Method** | GET |
| **Check Interval** | 15 minutes |
| **Timeout** | 10 seconds |
| **Expected Status** | 302 |
| **Follow Redirects** | No |
| **Regions** | Sydney |
| **Confirm After** | 2 failures |

---

### Monitor 10: Response Time (High)

Synthetic monitor for response time tracking.

| Field | Value |
|-------|-------|
| **Name** | `Genre Genie - Performance` |
| **URL** | `https://spotify.houstons.tech/health` |
| **Method** | GET |
| **Check Interval** | 1 minute |
| **Warning Threshold** | > 2000ms |
| **Critical Threshold** | > 5000ms |
| **Regions** | Sydney (primary) |

---

## Response Time Thresholds

| Level | Threshold | Action |
|-------|-----------|--------|
| **Healthy** | < 500ms | Normal operation |
| **Elevated** | 500ms - 2000ms | Log for review |
| **Warning** | 2000ms - 5000ms | Alert team |
| **Critical** | > 5000ms | Immediate investigation |

### Geographic Expectations

| Region | Expected Latency | Notes |
|--------|------------------|-------|
| Sydney (ap-southeast-2) | < 50ms | Primary region |
| Singapore (ap-southeast-1) | < 100ms | Nearest edge |
| US-East | < 200ms | Cross-Pacific |
| EU-West | < 250ms | Global edge |

---

## Alert Configuration

### Alert Channels

Configure multiple channels for redundancy:

#### Email Alerts (Primary)

| Setting | Value |
|---------|-------|
| **Recipients** | Primary admin email |
| **Frequency** | Immediate for Critical, Batched for Warning |
| **Include** | Error details, response time, region |

#### Slack Integration

```bash
# Webhook URL format (replace with your actual webhook)
https://hooks.slack.com/services/YOUR_TEAM_ID/YOUR_BOT_ID/YOUR_WEBHOOK_TOKEN
```

**Slack Alert Format:**
```
:rotating_light: Genre Genie - Health is DOWN
Region: Sydney
Response: 502 Bad Gateway
Duration: 2m 15s
```

#### Discord Integration

```bash
# Discord webhook URL
https://discord.com/api/webhooks/000000000000000000/xxxxxxxxxxxxxxxxxxxx
```

**Configure in BetterStack:**
1. Go to **Integrations** > **Discord**
2. Paste webhook URL
3. Select monitors to notify
4. Test the integration

### Escalation Policy

| Level | Condition | Action | Delay |
|-------|-----------|--------|-------|
| **L1** | Monitor down | Email + Slack | Immediate |
| **L2** | Down > 5 min | SMS alert | 5 minutes |
| **L3** | Down > 15 min | Phone call | 15 minutes |
| **L4** | Down > 30 min | Escalate to backup | 30 minutes |

### Alert Rules

```yaml
# Conceptual configuration
alerts:
  critical:
    monitors: [health, application, ssl, dns]
    channels: [email, slack, sms]
    confirm_after: 2
    
  warning:
    monitors: [stats, leaderboard, session]
    channels: [email, slack]
    confirm_after: 3
    
  info:
    monitors: [config, auth, performance]
    channels: [slack]
    confirm_after: 3
```

---

## Status Page Setup

### Creating the Status Page

1. Navigate to **Status Pages** > **Create**
2. Configure subdomain: `status.houstons.tech` or `geniegenie.betterstack.com`
3. Add branding (Genre Genie logo, Swedish blue/yellow theme)

### Component Configuration

| Component | Monitor(s) | Visibility |
|-----------|------------|------------|
| **Web Application** | Health, Application | Public |
| **API Services** | Stats, Leaderboard | Public |
| **Authentication** | Session, Auth | Public |
| **Infrastructure** | SSL, DNS | Public |
| **Performance** | Response Time | Public |

### Status Levels

| Status | Colour | Meaning |
|--------|--------|---------|
| **Operational** | Green | All systems functioning |
| **Degraded** | Yellow | Partial functionality |
| **Partial Outage** | Orange | Some services affected |
| **Major Outage** | Red | Critical systems down |
| **Maintenance** | Blue | Scheduled maintenance |

### Incident Communication Templates

#### Investigating Template
```markdown
**Investigating increased error rates**

We are currently investigating reports of [describe issue].

- Started: [time]
- Affected: [components]
- Impact: [user impact]

We will provide updates as we learn more.
```

#### Identified Template
```markdown
**Issue identified**

We have identified the cause of [issue description].

- Root cause: [brief description]
- Fix: [action being taken]
- ETA: [estimated resolution time]

We are working to resolve this as quickly as possible.
```

#### Resolved Template
```markdown
**Issue resolved**

The [issue description] has been resolved.

- Duration: [total downtime]
- Root cause: [what happened]
- Resolution: [what was done]
- Prevention: [future measures]

We apologise for any inconvenience caused.
```

### Maintenance Window Procedures

#### Scheduling Maintenance

1. Go to **Status Pages** > **Scheduled Maintenance**
2. Set start and end times
3. Select affected components
4. Add maintenance description
5. Enable subscriber notifications

#### Maintenance Template
```markdown
**Scheduled Maintenance: [Title]**

We will be performing scheduled maintenance on [components].

- **Start:** [date/time] AEDT
- **End:** [date/time] AEDT
- **Duration:** [X hours]
- **Impact:** [expected impact]

During this time, [what users can expect].

No action is required from users.
```

---

## Dashboard Metrics

### Key Performance Indicators

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Uptime** | 99.9% | Monthly average |
| **MTTR** | < 30 min | Mean time to recovery |
| **MTTD** | < 5 min | Mean time to detect |
| **Response Time (P95)** | < 500ms | 95th percentile |
| **Error Rate** | < 0.1% | 5xx responses |

### Uptime Calculation

```
Uptime % = ((Total Minutes - Downtime Minutes) / Total Minutes) × 100

Monthly target: 99.9%
= 43,200 minutes - 43.2 minutes downtime
= Maximum 43 minutes downtime per month
```

### BetterStack Dashboard Widgets

Configure the following widgets:

| Widget | Type | Period |
|--------|------|--------|
| Uptime Summary | Percentage | 30 days |
| Response Time | Line graph | 24 hours |
| Incidents | Count | 30 days |
| MTTR | Average | 30 days |
| Status by Region | Map | Real-time |

---

## Integration with Application

### Shields.io Status Badge

Add to `README.md`:

```markdown
<!-- Static badge (fallback) -->
[![Status](https://img.shields.io/badge/Status-Live-brightgreen?style=for-the-badge)](https://status.houstons.tech)

<!-- BetterStack dynamic badge (if available) -->
[![Uptime](https://betterstack.com/status-badges/v1/monitor/xxxxx.svg)](https://status.houstons.tech)
```

### Badge Variants

| Style | Badge |
|-------|-------|
| **For-the-badge** | `?style=for-the-badge` |
| **Flat** | `?style=flat` |
| **Flat-square** | `?style=flat-square` |

### Status Widget in Footer

Add to application footer:

```html
<!-- Status indicator -->
<a href="https://status.houstons.tech" 
   target="_blank" 
   rel="noopener noreferrer"
   class="status-link">
  <span class="status-dot"></span>
  <span>System Status</span>
</a>

<style>
.status-link {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  color: inherit;
  text-decoration: none;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #22c55e; /* Green when operational */
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
</style>
```

### Dynamic Status Fetch

```typescript
// Fetch current status from BetterStack API
async function getSystemStatus(): Promise<'operational' | 'degraded' | 'down'> {
  try {
    const response = await fetch('https://status.houstons.tech/api/v1/status');
    const data = await response.json();
    return data.status;
  } catch {
    return 'operational'; // Fail open
  }
}
```

---

## Cloudflare Analytics Integration

Supplement BetterStack with Cloudflare's built-in analytics:

### Workers Analytics

| Metric | Location | Use |
|--------|----------|-----|
| Request count | Workers > Analytics | Traffic volume |
| CPU time | Workers > Analytics | Performance |
| Duration P99 | Workers > Analytics | Latency spikes |
| Error rate | Workers > Analytics | 4xx/5xx tracking |
| Geographic | Workers > Analytics | User distribution |

### Useful Cloudflare Metrics

```bash
# View real-time logs
npx wrangler tail spotify-genre-sorter

# Filter for errors
npx wrangler tail spotify-genre-sorter --status error
```

---

## Webhook Integration

### Deployment Notifications

Add to GitHub Actions workflow:

```yaml
# .github/workflows/deploy.yml
- name: Notify BetterStack - Deploy Started
  if: always()
  run: |
    curl -X POST "${{ secrets.BETTERSTACK_WEBHOOK }}" \
      -H "Content-Type: application/json" \
      -d '{
        "event": "deployment_started",
        "version": "${{ github.sha }}",
        "environment": "production"
      }'

- name: Notify BetterStack - Deploy Complete
  if: success()
  run: |
    curl -X POST "${{ secrets.BETTERSTACK_WEBHOOK }}" \
      -H "Content-Type: application/json" \
      -d '{
        "event": "deployment_complete",
        "version": "${{ github.sha }}",
        "status": "success"
      }'
```

### Heartbeat Monitors

For cron jobs or scheduled tasks:

```typescript
// Send heartbeat after successful task
await fetch('https://betterstack.com/api/v1/heartbeat/xxxxx', {
  method: 'POST'
});
```

---

## Quick Reference

### Monitor URLs

```text
https://spotify.houstons.tech/health
https://spotify.houstons.tech/
https://spotify.houstons.tech/api/stats
https://spotify.houstons.tech/api/leaderboard
https://spotify.houstons.tech/api/session
https://spotify.houstons.tech/setup
https://spotify.houstons.tech/auth/spotify
```

### Setup Checklist

- [ ] Create BetterStack account
- [ ] Configure 10 monitors as specified
- [ ] Set up alert channels (email, Slack/Discord)
- [ ] Create status page
- [ ] Add status badge to README
- [ ] Configure escalation policy
- [ ] Test all alerts
- [ ] Document on-call rotation
- [ ] Add webhook to deployment pipeline

### Troubleshooting

| Issue | Check | Resolution |
|-------|-------|------------|
| False positives | Region mismatch | Add Sydney as primary region |
| High latency alerts | Cloudflare edge | Check CF Analytics for CPU time |
| SSL warnings | Certificate renewal | Verify Cloudflare SSL settings |
| Monitor timeout | Network path | Increase timeout, add retries |

---

## Related Documentation

- [High Availability & Deployment](high-availability.md)
- [Security Architecture](security.md)
- [API Documentation](api.md)
- [Backup & Disaster Recovery](backup-dr.md)

---

*Last updated: December 2025*
