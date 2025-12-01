# Monitoring Setup Guide

## Overview

This guide covers setting up monitoring for Spotify Genre Sorter using BetterStack (formerly BetterUptime) or similar services.

## Quick Start

### 1. BetterStack Setup

1. Sign up at [betterstack.com](https://betterstack.com)
2. Create a new monitor:
   - **URL**: `https://swedify.houstons.tech/health`
   - **Check interval**: 1 minute
   - **Timeout**: 10 seconds
   - **Alert after**: 3 consecutive failures

### 2. Status Page

1. Create a status page in BetterStack
2. Add your monitor to the page
3. Get the status page URL (e.g., `https://status.houstons.tech`)

## Health Endpoints

### Basic Health Check

```
GET /health
```

Response:
```json
{
  "status": "ok",
  "version": "1.2.1"
}
```

Use this for uptime monitoring. Fast response, no external dependencies checked.

### Detailed Health Check

```
GET /health?detailed=true
```

Response:
```json
{
  "status": "ok",
  "version": "1.2.1",
  "components": {
    "kv": {
      "status": "ok",
      "latency": 12
    },
    "secrets": {
      "status": "ok"
    }
  },
  "timestamp": "2025-12-01T10:30:00.000Z"
}
```

Component statuses:
- `ok` - Component healthy
- `error` - Component failing
- `missing` - Configuration missing
- `degraded` - Partial functionality

## Monitoring Strategy

### What to Monitor

| Metric | Endpoint | Threshold | Alert |
|--------|----------|-----------|-------|
| Uptime | `/health` | 200 OK | 3 failures |
| Response time | `/health` | >2 seconds | Warning |
| SSL certificate | Any HTTPS | <30 days expiry | Warning |
| API availability | `/api/genres` | 401/500 | 5 failures |

### Alert Channels

Configure alerts via:
- Email (primary)
- Slack (team notifications)
- PagerDuty (on-call escalation)
- SMS (critical only)

### Alert Severity Levels

| Level | Condition | Response Time |
|-------|-----------|---------------|
| **Critical** | Service down >5 min | Immediate |
| **Warning** | Response time >2s | 1 hour |
| **Info** | Deployment completed | N/A |

## Cloudflare Analytics

Cloudflare Workers provides built-in analytics:

1. Go to **Workers & Pages** → Your worker → **Analytics**
2. View:
   - Request count
   - CPU time
   - Duration percentiles
   - Error rates
   - Geographic distribution

### Useful Cloudflare Metrics

| Metric | Where to Find |
|--------|---------------|
| Requests/day | Workers Analytics dashboard |
| P99 latency | Workers Analytics → Duration |
| Error rate | Workers Analytics → Status codes |
| CPU time | Workers Analytics → CPU time |
| Bandwidth | Zone Analytics |

## Custom Metrics (Future)

For custom metrics, consider:

### Analytics Engine (Cloudflare)

```typescript
// Write custom metrics
c.env.ANALYTICS.writeDataPoint({
  blobs: ['playlist_created'],
  doubles: [1],
  indexes: [session.spotifyUserId]
});
```

### External Monitoring (e.g., Grafana Cloud)

Send metrics via HTTP:
```typescript
// POST to Grafana Cloud
await fetch('https://graphite.grafana.net/metrics', {
  method: 'POST',
  body: JSON.stringify({
    name: 'spotify_genre_sorter.playlists_created',
    value: 1,
    time: Date.now()
  })
});
```

## Incident Response Integration

### BetterStack Incident Management

1. Monitor triggers alert
2. Incident created automatically
3. On-call person notified
4. Track resolution in timeline
5. Post-mortem in incident history

### Webhook Integration

Add webhook to deployment pipeline:

```yaml
# In deploy.yml
- name: Notify BetterStack
  if: success()
  run: |
    curl -X POST "https://betterstack.com/webhooks/..." \
      -d '{"event":"deployment","version":"${{ env.APP_VERSION }}"}'
```

## Status Badge Integration

### Shields.io Badge

Static badge (current implementation):
```markdown
[![Status](https://img.shields.io/badge/Status-Live-brightgreen)](https://status.houstons.tech)
```

### BetterStack Dynamic Badge

If BetterStack provides a status badge URL:
```markdown
[![Uptime](https://betterstack.com/badge/xxx.svg)](https://status.houstons.tech)
```

## Monitoring Checklist

### Initial Setup

- [ ] Create BetterStack account
- [ ] Add `/health` monitor (1 min interval)
- [ ] Configure alert channels (email, Slack)
- [ ] Create status page
- [ ] Add badge to README

### Ongoing

- [ ] Review alerts weekly
- [ ] Check response times monthly
- [ ] Update thresholds as needed
- [ ] Document incidents

## Recommended Services

| Service | Use Case | Free Tier |
|---------|----------|-----------|
| **BetterStack** | Uptime, incidents | 5 monitors |
| **Cloudflare Analytics** | Workers metrics | Included |
| **Sentry** | Error tracking | 5K errors/month |
| **Grafana Cloud** | Custom metrics | 10K series |

## Example BetterStack Configuration

```yaml
# betterstack.yml (conceptual)
monitors:
  - name: Spotify Genre Sorter - Production
    url: https://swedify.houstons.tech/health
    check_interval: 60
    expected_status_codes: [200]
    timeout: 10
    regions:
      - us-east
      - eu-west
      - ap-southeast
    alert_policy:
      threshold: 3
      channels:
        - email
        - slack

  - name: Spotify Genre Sorter - API
    url: https://swedify.houstons.tech/api/changelog
    check_interval: 300
    expected_status_codes: [200]

status_page:
  name: Spotify Genre Sorter Status
  subdomain: status
  components:
    - name: Web Application
      monitor: Spotify Genre Sorter - Production
    - name: API
      monitor: Spotify Genre Sorter - API
```

## Troubleshooting

### Monitor Shows Down But Site Works

1. Check monitor region vs Cloudflare edge location
2. Verify no geo-blocking on Cloudflare
3. Check if maintenance window active
4. Verify URL is correct (https, correct path)

### High Latency Alerts

1. Check Cloudflare Analytics for CPU time
2. Review recent deployments
3. Check Spotify API status
4. Verify KV namespace health

### False Positives

Configure alert dampening:
- Require 3 consecutive failures before alerting
- Add delay before first alert (30 seconds)
- Use multiple monitoring regions

---

*Last updated: December 2025*
