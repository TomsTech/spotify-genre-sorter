User:
You are tasked to implement a feature. Instructions are as follows:

I have a few tasks separated out below by task - context - requirements. Please complete them all to the best of your ability and in parralel to expediate the process. Then review every document/.md within this set of files and update them to reflect the new architecuural/docuemntatitve changes that have been made in absolute detail useing correct formatting and mermaid diagrams, for processes chaange timeline, etc.

Implement genre caching in Cloudflare KV to reduce Spotify API calls.

Context:
- Currently we fetch all liked tracks + all artists on every /api/genres call
- This is slow for large libraries and hits Spotify rate limits
- Cache structure: user_genres_{spotify_user_id} -> { genres, timestamp, trackCount }
- Cache TTL: 1 hour (user can force refresh)
- Files: src/routes/api.ts, src/lib/session.ts

Requirements:
- Add cache check before fetching from Spotify
- Add "last updated" indicator in UI
- Add manual refresh button
- Invalidate cache when user creates a playlist (library changed)

Let users customise playlist names before creation.

Context:
- Currently hardcoded as "{genre} (from Likes)"
- Users might want different formats or prefixes
- Files: src/index.ts (UI), src/routes/api.ts

Requirements:
- Add template input: "{genre} - My Collection" etc
- Preview what playlists will be named
- Remember preference in localStorage
- Swedish translation support



Add real-time progress indicator when fetching genres for large libraries.

Context:
- Users with 1000+ liked songs see a spinner for 30+ seconds with no feedback
- Spotify API is paginated (50 tracks per request)
- We already have onProgress callback in getAllLikedTracks()
- Files: src/index.ts (frontend), src/lib/spotify.ts, src/routes/api.ts

Requirements:
- Show "Loading tracks... 150/2000" style progress
- Show artist fetching progress separately
- Use Server-Sent Events (SSE) or polling for real-time updates
- Swedish translation for progress messages

Feature Specification: Floating Deployment Monitor
Objective: Implement a minimalist, floating status widget in the top-right sidebar to monitor GitHub Actions/Runners in real-time.

1. UI/UX Design
Location: Top right-hand corner.

Style: Minimalist, "light" design (floating alert window style).

Visibility: Always visible but unobtrusive.

2. Functional States
A. State: Deployment in Progress

Trigger: When a GitHub Action/Runner is active.

Refresh Rate: Updates every 5 seconds.

Visual Elements:

Small progress circle (visualizing the percentage complete).

Text: "New Deployment [Version Number]".

Dynamic Text: Displays the specific name of the current step in the process (e.g., "Building," "Testing," "Deploying").

B. State: Idle (No Deployment)

Trigger: When no pipelines are running.

Visual Elements:

Text: "Last update at [Time], by [Name]".

Image: The GitHub profile picture of the user who triggered the last deployment.

3. Version Control & Caching Logic
Version Mismatch Detection: The widget must detect if the user is currently viewing a cached/old version of the site while a newer version exists.

Action:

Priority: Automatically clear cache/refresh the page for the user if possible.

Fallback: If auto-refresh is not possible, the widget changes to an alert state prompting the user to manually refresh.

Instructions for the output format:
- Output code without explanation, unless it is important.
- Minimize prose, comments and empty lines.
- ONLY show the relevant code that needs to be modified. Use comments to represent the parts that are not modified.
- Do NOT output full code. Only output parts that need to be changed.
- Make it easy to copy and paste.
- Consider other possibilities to achieve the result, do not be limited by the prompt.

.claude-context.md
```md
# Claude Context Notes - Spotify Genre Sorter

> **Last Updated**: 2025-11-28
> **Session**: v1.0 development sprint

## Project State

### What This Is
Cloudflare Workers app using Hono framework that sorts Spotify liked songs into genre-based playlists.

### What's Been Done
- [x] Fixed null artist bug in `src/lib/spotify.ts:178` - Spotify API returns null for some artists
- [x] Added Spotify-only auth mode (no GitHub required) - controlled by `SPOTIFY_ONLY_AUTH` env var
- [x] User registration tracking + Hall of Fame in KV storage
- [x] Stats endpoint `/api/stats` for user counter
- [x] Created `.github/workflows/secrets.yml` for CI/CD secret management
- [x] "Shout me a durry" donation button (Aussie style)
- [x] Swedish mode easter egg with sound chime
- [x] Updated session/setup endpoints for both auth modes

### Key Files Modified
- `src/lib/spotify.ts` - null artist filter fix
- `src/routes/auth.ts` - Spotify-only mode + user registration
- `src/lib/session.ts` - added spotifyUser/spotifyUserId/spotifyAvatar fields
- `src/types.ts` - optional GitHub fields, SPOTIFY_ONLY_AUTH
- `src/index.ts` - massive UI updates, stats endpoint, dual auth mode

### Secrets Already Set (via Cloudflare API)
- GITHUB_CLIENT_ID: Ov23liDlo9GDoPXXpbaa
- GITHUB_CLIENT_SECRET: (set)
- SPOTIFY_CLIENT_ID: ce4b12eee7fc4fd6b305361c18b7411c
- SPOTIFY_CLIENT_SECRET: (set)

### Deployment Info
- Worker: `spotify-genre-sorter`
- Subdomain: `dev-playground-df5.workers.dev`
- Custom domain: `spotify.houstons.tech`
- Account ID: `df52a0cfc6c1765f726a830ef84ba78c`

### Known Issues / Gotchas
1. GitHub Actions needs `always()` condition for jobs that depend on skippable jobs
2. KV namespace ID gets replaced at deploy time via sed
3. wrangler commands need CLOUDFLARE_API_TOKEN env var in non-interactive mode

### Next Steps (v2.0 ideas from user)
- Source selection UI (liked songs vs all playlists)
- CD rack animation with embarrassing playlist yeeting
- Fun loading screen with random facts + album art carousel
- Confetti celebration on completion
- Progress bar with ETA

### Swedish Codename for v1.0
**"Förtrollad"** = Enchanted/Spellbound (for Heidi)

### Testing Commands
```bash
# Local dev
npm run dev

# Type check
npm run typecheck

# Deploy manually
npm run deploy

# Check health
curl https://spotify.houstons.tech/health
curl https://spotify.houstons.tech/setup
```

### User's Repo for Auto-Documentation
`C:\Git\PowerAppsCICDTemplate` - has scripts for READMEs, changelogs, diagrams
```

.github\workflows\ci.yml
```yml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

permissions:
  contents: read
  security-events: write

jobs:
  lint:
    name: Lint & Type Check
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm install

      - name: Run ESLint
        run: npm run lint

      - name: Run TypeScript type check
        run: npm run typecheck

  security:
    name: Security Scan
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm install

      - name: Run npm audit
        run: npm audit --audit-level=high
        continue-on-error: true

      - name: Run Snyk security scan
        uses: snyk/actions/node@master
        continue-on-error: true
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
        with:
          args: --severity-threshold=high

      - name: Initialize CodeQL
        uses: github/codeql-action/init@v4
        with:
          languages: typescript

      - name: Perform CodeQL Analysis
        uses: github/codeql-action/analyze@v4

  test:
    name: Unit Tests
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm install

      - name: Run tests
        run: npm test

  build:
    name: Build
    runs-on: ubuntu-latest
    needs: [lint, test]
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm install

      - name: Build worker
        run: npm run build

      - name: Upload build artifact
        uses: actions/upload-artifact@v4
        with:
          name: worker-build
          path: dist/
          retention-days: 7
```

.github\workflows\deploy.yml
```yml
name: Deploy

on:
  push:
    branches: [main]
  workflow_dispatch:
    inputs:
      custom_domain:
        description: 'Custom domain (e.g., spotify.example.com)'
        required: false
        type: string
      skip_staging:
        description: 'Skip staging deployment'
        required: false
        type: boolean
        default: false
      force_dns:
        description: 'Force DNS update even if existing record found'
        required: false
        type: boolean
        default: false

concurrency:
  group: deploy-${{ github.ref }}
  cancel-in-progress: true

permissions:
  contents: write
  deployments: write
  pull-requests: write

env:
  STAGING_WORKER: spotify-genre-sorter-staging
  PRODUCTION_WORKER: spotify-genre-sorter
  WORKER_SUBDOMAIN: dev-playground-df5.workers.dev

jobs:
  quality:
    name: Code Quality
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - name: Install dependencies
        run: npm install
      - name: ESLint
        run: npm run lint
      - name: TypeScript Check
        run: npm run typecheck
      - name: Build Test
        run: npm run build

  security:
    name: Security Scan
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - name: Install dependencies
        run: npm install
      - name: npm audit
        run: npm audit --audit-level=moderate
        continue-on-error: true
      - name: Snyk Security Scan
        if: ${{ vars.SNYK_ENABLED == 'true' }}
        uses: snyk/actions/node@master
        continue-on-error: true
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}

  get-account-id:
    name: Get Cloudflare Account
    runs-on: ubuntu-latest
    outputs:
      account_id: ${{ steps.account.outputs.id }}
    steps:
      - name: Fetch Account ID from API Token
        id: account
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
        run: |
          echo "Fetching Cloudflare account ID from API token..."
          RESPONSE=$(curl -s -X GET "https://api.cloudflare.com/client/v4/accounts" \
            -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
            -H "Content-Type: application/json")
          SUCCESS=$(echo "$RESPONSE" | jq -r '.success')
          if [ "$SUCCESS" != "true" ]; then
            echo "::error::Failed to fetch account. Check CLOUDFLARE_API_TOKEN."
            exit 1
          fi
          ACCOUNT_ID=$(echo "$RESPONSE" | jq -r '.result[0].id')
          if [ -z "$ACCOUNT_ID" ] || [ "$ACCOUNT_ID" == "null" ]; then
            echo "::error::No accounts found for this API token"
            exit 1
          fi
          echo "Found account: $ACCOUNT_ID"
          echo "id=$ACCOUNT_ID" >> $GITHUB_OUTPUT

  check-dns-conflicts:
    name: Check DNS Conflicts
    runs-on: ubuntu-latest
    needs: [get-account-id]
    if: ${{ vars.CUSTOM_DOMAIN != '' || inputs.custom_domain != '' }}
    outputs:
      zone_id: ${{ steps.dns.outputs.zone_id }}
      has_conflict: ${{ steps.dns.outputs.has_conflict }}
    steps:
      - name: Check for existing DNS records
        id: dns
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
        run: |
          DOMAIN="${{ inputs.custom_domain || vars.CUSTOM_DOMAIN }}"
          echo "Checking DNS for: $DOMAIN"
          BASE_DOMAIN=$(echo "$DOMAIN" | awk -F. '{print $(NF-1)"."$NF}')

          ZONES=$(curl -s -X GET "https://api.cloudflare.com/client/v4/zones?name=$BASE_DOMAIN" \
            -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
            -H "Content-Type: application/json")
          ZONE_ID=$(echo "$ZONES" | jq -r '.result[0].id')

          if [ -z "$ZONE_ID" ] || [ "$ZONE_ID" == "null" ]; then
            echo "::error::Could not find DNS zone for $BASE_DOMAIN"
            echo "::error::Ensure domain is in Cloudflare and token has Zone:Read permission"
            exit 1
          fi
          echo "zone_id=$ZONE_ID" >> $GITHUB_OUTPUT

          RECORDS=$(curl -s -X GET \
            "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records?name=$DOMAIN" \
            -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
            -H "Content-Type: application/json")
          COUNT=$(echo "$RECORDS" | jq -r '.result | length')

          if [ "$COUNT" -gt 0 ]; then
            TYPE=$(echo "$RECORDS" | jq -r '.result[0].type')
            CONTENT=$(echo "$RECORDS" | jq -r '.result[0].content')
            echo "has_conflict=true" >> $GITHUB_OUTPUT

            if [ "${{ inputs.force_dns }}" != "true" ]; then
              echo "::error::DNS CONFLICT: $TYPE record exists for $DOMAIN pointing to $CONTENT"
              echo "::error::Options: 1) Delete record in Cloudflare 2) Re-run with force_dns 3) Use different subdomain"
              exit 1
            fi
          else
            echo "has_conflict=false" >> $GITHUB_OUTPUT
          fi

  deploy-staging:
    name: Deploy to Staging
    runs-on: ubuntu-latest
    needs: [quality, security, get-account-id]
    if: ${{ !inputs.skip_staging }}
    environment:
      name: staging
      url: https://${{ env.STAGING_WORKER }}.${{ env.WORKER_SUBDOMAIN }}
    steps:
      - uses: actions/checkout@v4
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - name: Install dependencies
        run: npm install
      - name: Configure Staging
        run: sed -i 's/name = "spotify-genre-sorter"/name = "${{ env.STAGING_WORKER }}"/g' wrangler.toml
      - name: Setup KV Namespace
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ needs.get-account-id.outputs.account_id }}
        run: |
          # Use Cloudflare API directly to list KV namespaces
          NAMESPACES=$(curl -s -X GET \
            "https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/storage/kv/namespaces" \
            -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
            -H "Content-Type: application/json")

          # Find existing SESSIONS namespace or create one
          NAMESPACE_ID=$(echo "$NAMESPACES" | jq -r '.result[] | select(.title | contains("SESSIONS")) | .id' | head -1)

          if [ -z "$NAMESPACE_ID" ] || [ "$NAMESPACE_ID" == "null" ]; then
            echo "Creating new KV namespace..."
            CREATE_RESULT=$(curl -s -X POST \
              "https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/storage/kv/namespaces" \
              -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
              -H "Content-Type: application/json" \
              --data '{"title":"spotify-genre-sorter-SESSIONS"}')
            NAMESPACE_ID=$(echo "$CREATE_RESULT" | jq -r '.result.id')
          fi

          if [ -n "$NAMESPACE_ID" ] && [ "$NAMESPACE_ID" != "null" ]; then
            echo "Using KV namespace: $NAMESPACE_ID"
            sed -i "s/YOUR_KV_NAMESPACE_ID/$NAMESPACE_ID/g" wrangler.toml
          else
            echo "::error::Could not find or create KV namespace"
            exit 1
          fi

          # Debug: show wrangler.toml kv section
          grep -A2 "kv_namespaces" wrangler.toml || true
      - name: Deploy to Staging
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ needs.get-account-id.outputs.account_id }}
          command: deploy --minify

  verify-staging:
    name: Verify Staging
    runs-on: ubuntu-latest
    needs: [deploy-staging]
    if: ${{ !inputs.skip_staging }}
    steps:
      - name: Health Check
        run: |
          sleep 15
          URL="https://${{ env.STAGING_WORKER }}.${{ env.WORKER_SUBDOMAIN }}"
          for i in 1 2 3; do
            CODE=$(curl -s -o /dev/null -w "%{http_code}" "$URL/health")
            if [ "$CODE" == "200" ]; then echo "Staging OK"; exit 0; fi
            sleep 5
          done
          echo "::error::Staging health check failed"
          exit 1

  deploy-production:
    name: Deploy to Production
    runs-on: ubuntu-latest
    needs: [quality, security, verify-staging, get-account-id, check-dns-conflicts]
    if: |
      always() &&
      needs.quality.result == 'success' &&
      needs.security.result == 'success' &&
      needs.get-account-id.result == 'success' &&
      (needs.verify-staging.result == 'success' || inputs.skip_staging) &&
      (needs.check-dns-conflicts.result == 'success' || needs.check-dns-conflicts.result == 'skipped')
    environment:
      name: production
      url: https://${{ env.PRODUCTION_WORKER }}.${{ env.WORKER_SUBDOMAIN }}
    outputs:
      deployed: ${{ steps.deploy.outcome == 'success' }}
    steps:
      - uses: actions/checkout@v4
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - name: Install dependencies
        run: npm install
      - name: Setup KV Namespace
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ needs.get-account-id.outputs.account_id }}
        run: |
          # Use Cloudflare API directly to list KV namespaces
          NAMESPACES=$(curl -s -X GET \
            "https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/storage/kv/namespaces" \
            -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
            -H "Content-Type: application/json")

          # Find existing SESSIONS namespace or create one
          NAMESPACE_ID=$(echo "$NAMESPACES" | jq -r '.result[] | select(.title | contains("SESSIONS")) | .id' | head -1)

          if [ -z "$NAMESPACE_ID" ] || [ "$NAMESPACE_ID" == "null" ]; then
            echo "Creating new KV namespace..."
            CREATE_RESULT=$(curl -s -X POST \
              "https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/storage/kv/namespaces" \
              -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
              -H "Content-Type: application/json" \
              --data '{"title":"spotify-genre-sorter-SESSIONS"}')
            NAMESPACE_ID=$(echo "$CREATE_RESULT" | jq -r '.result.id')
          fi

          if [ -n "$NAMESPACE_ID" ] && [ "$NAMESPACE_ID" != "null" ]; then
            echo "Using KV namespace: $NAMESPACE_ID"
            sed -i "s/YOUR_KV_NAMESPACE_ID/$NAMESPACE_ID/g" wrangler.toml
          else
            echo "::error::Could not find or create KV namespace"
            exit 1
          fi

          # Debug: show wrangler.toml kv section
          grep -A2 "kv_namespaces" wrangler.toml || true
      - name: Deploy to Production
        id: deploy
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ needs.get-account-id.outputs.account_id }}
          command: deploy --minify

  verify-production:
    name: Verify Production
    runs-on: ubuntu-latest
    needs: [deploy-production]
    if: always() && needs.deploy-production.result == 'success'
    outputs:
      healthy: ${{ steps.health.outputs.ok }}
    steps:
      - name: Health Check
        id: health
        run: |
          sleep 20
          URL="https://${{ env.PRODUCTION_WORKER }}.${{ env.WORKER_SUBDOMAIN }}"
          for i in 1 2 3 4 5; do
            CODE=$(curl -s -o /dev/null -w "%{http_code}" "$URL/health")
            if [ "$CODE" == "200" ]; then
              echo "ok=true" >> $GITHUB_OUTPUT
              exit 0
            fi
            sleep 5
          done
          echo "::error::Production health check failed"
          echo "ok=false" >> $GITHUB_OUTPUT
          exit 1

  dns-cutover:
    name: DNS Cutover
    runs-on: ubuntu-latest
    needs: [verify-production, get-account-id, check-dns-conflicts]
    if: |
      always() &&
      needs.verify-production.outputs.healthy == 'true' &&
      (vars.CUSTOM_DOMAIN != '' || inputs.custom_domain != '') &&
      (needs.check-dns-conflicts.result == 'success' || needs.check-dns-conflicts.result == 'skipped')
    steps:
      - name: Configure Custom Domain
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ needs.get-account-id.outputs.account_id }}
          ZONE_ID: ${{ needs.check-dns-conflicts.outputs.zone_id }}
        run: |
          DOMAIN="${{ inputs.custom_domain || vars.CUSTOM_DOMAIN }}"

          # Delete existing DNS record if force_dns requested or conflict detected
          if [ "${{ inputs.force_dns }}" == "true" ] || [ "${{ needs.check-dns-conflicts.outputs.has_conflict }}" == "true" ]; then
            echo "Removing existing DNS records for $DOMAIN..."
            RECORDS=$(curl -s -X GET \
              "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records?name=$DOMAIN" \
              -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
              -H "Content-Type: application/json")
            echo "Found records: $(echo "$RECORDS" | jq '.result | length')"
            for RECORD_ID in $(echo "$RECORDS" | jq -r '.result[].id'); do
              echo "Deleting record: $RECORD_ID"
              curl -s -X DELETE "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records/$RECORD_ID" \
                -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN"
            done
          fi

          # Delete existing worker routes for this domain
          EXISTING_ROUTES=$(curl -s -X GET \
            "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/workers/routes" \
            -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
            -H "Content-Type: application/json")
          ROUTE_ID=$(echo "$EXISTING_ROUTES" | jq -r ".result[] | select(.pattern | contains(\"$DOMAIN\")) | .id" | head -1)
          if [ -n "$ROUTE_ID" ] && [ "$ROUTE_ID" != "null" ]; then
            echo "Deleting existing route: $ROUTE_ID"
            curl -s -X DELETE "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/workers/routes/$ROUTE_ID" \
              -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN"
          fi

          # Use Workers Custom Domains API (the correct way to add custom domains)
          echo "Adding custom domain via Workers Custom Domains API..."
          CUSTOM_DOMAIN_RESULT=$(curl -s -X PUT \
            "https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/workers/domains" \
            -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
            -H "Content-Type: application/json" \
            --data "{\"hostname\":\"$DOMAIN\",\"service\":\"${{ env.PRODUCTION_WORKER }}\",\"zone_id\":\"$ZONE_ID\",\"environment\":\"production\"}")

          if echo "$CUSTOM_DOMAIN_RESULT" | jq -e '.success' > /dev/null; then
            echo "Custom domain configured: $DOMAIN -> ${{ env.PRODUCTION_WORKER }}"
            echo "$CUSTOM_DOMAIN_RESULT" | jq '.result'
          else
            echo "::warning::Custom domain setup result: $CUSTOM_DOMAIN_RESULT"
          fi

          # Always create DNS CNAME record (force recreation if force_dns)
          echo "Creating DNS CNAME record..."
          DNS_RESULT=$(curl -s -X POST "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records" \
            -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
            -H "Content-Type: application/json" \
            --data "{\"type\":\"CNAME\",\"name\":\"$DOMAIN\",\"content\":\"${{ env.PRODUCTION_WORKER }}.${{ env.WORKER_SUBDOMAIN }}\",\"ttl\":1,\"proxied\":true}")
          echo "$DNS_RESULT" | jq '.'
          if echo "$DNS_RESULT" | jq -e '.success' > /dev/null; then
            echo "DNS record created successfully"
          else
            echo "Note: $(echo "$DNS_RESULT" | jq -r '.errors[0].message // "DNS record may already exist"')"
          fi

  cleanup:
    name: Cleanup Staging
    runs-on: ubuntu-latest
    needs: [verify-production, get-account-id]
    if: success() && !inputs.skip_staging
    steps:
      - uses: actions/checkout@v4
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - name: Install dependencies
        run: npm install
      - name: Delete Staging
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ needs.get-account-id.outputs.account_id }}
        run: npx wrangler delete ${{ env.STAGING_WORKER }} --force || true
        continue-on-error: true

  report:
    name: Deployment Report
    runs-on: ubuntu-latest
    needs: [quality, security, deploy-staging, verify-staging, deploy-production, verify-production, dns-cutover, get-account-id]
    if: always()
    steps:
      - name: Generate Report
        run: |
          echo "# Deployment Report" >> $GITHUB_STEP_SUMMARY
          echo "" >> $GITHUB_STEP_SUMMARY
          echo "| Stage | Status |" >> $GITHUB_STEP_SUMMARY
          echo "|-------|--------|" >> $GITHUB_STEP_SUMMARY
          echo "| Account Detection | ${{ needs.get-account-id.result }} |" >> $GITHUB_STEP_SUMMARY
          echo "| Code Quality | ${{ needs.quality.result }} |" >> $GITHUB_STEP_SUMMARY
          echo "| Security | ${{ needs.security.result }} |" >> $GITHUB_STEP_SUMMARY
          echo "| Staging | ${{ needs.deploy-staging.result }} |" >> $GITHUB_STEP_SUMMARY
          echo "| Production | ${{ needs.deploy-production.result }} |" >> $GITHUB_STEP_SUMMARY
          echo "| DNS Cutover | ${{ needs.dns-cutover.result }} |" >> $GITHUB_STEP_SUMMARY
          echo "" >> $GITHUB_STEP_SUMMARY
          echo "**Worker**: https://${{ env.PRODUCTION_WORKER }}.${{ env.WORKER_SUBDOMAIN }}" >> $GITHUB_STEP_SUMMARY
```

.github\workflows\release.yml
```yml
name: Release

on:
  push:
    tags:
      - 'v*'

permissions:
  contents: write
  pull-requests: read

jobs:
  release:
    name: Create Release
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Generate changelog
        id: changelog
        uses: orhun/git-cliff-action@v3
        with:
          config: cliff.toml
          args: --current --strip header
        env:
          OUTPUT: CHANGELOG.md

      - name: Create GitHub Release
        uses: softprops/action-gh-release@v1
        with:
          body: ${{ steps.changelog.outputs.content }}
          draft: false
          prerelease: ${{ contains(github.ref, 'alpha') || contains(github.ref, 'beta') || contains(github.ref, 'rc') }}
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

  update-changelog:
    name: Update Changelog
    runs-on: ubuntu-latest
    needs: [release]
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
          ref: main

      - name: Generate full changelog
        uses: orhun/git-cliff-action@v3
        with:
          config: cliff.toml
          args: --verbose
        env:
          OUTPUT: CHANGELOG.md

      - name: Commit changelog
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add CHANGELOG.md
          git diff --staged --quiet || git commit -m "docs: update CHANGELOG.md for ${{ github.ref_name }}"
          git push
```

.github\workflows\secrets.yml
```yml
name: Set Worker Secrets

on:
  workflow_dispatch:
    inputs:
      confirm:
        description: 'Type "yes" to confirm setting secrets'
        required: true
        type: string

permissions:
  contents: read

jobs:
  set-secrets:
    name: Configure Worker Secrets
    runs-on: ubuntu-latest
    if: ${{ inputs.confirm == 'yes' }}
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Validate Required Secrets
        run: |
          MISSING=""
          if [ -z "${{ secrets.SPOTIFY_CLIENT_ID }}" ]; then MISSING="$MISSING SPOTIFY_CLIENT_ID"; fi
          if [ -z "${{ secrets.SPOTIFY_CLIENT_SECRET }}" ]; then MISSING="$MISSING SPOTIFY_CLIENT_SECRET"; fi

          # GitHub OAuth is optional (for Spotify-only mode)
          if [ -n "${{ secrets.GITHUB_OAUTH_CLIENT_ID }}" ] && [ -z "${{ secrets.GITHUB_OAUTH_CLIENT_SECRET }}" ]; then
            echo "::error::GITHUB_OAUTH_CLIENT_ID provided but GITHUB_OAUTH_CLIENT_SECRET is missing"
            exit 1
          fi

          if [ -n "$MISSING" ]; then
            echo "::error::Missing required secrets:$MISSING"
            echo "Go to Settings > Secrets > Actions and add them"
            exit 1
          fi
          echo "All required secrets present"

      - name: Set Spotify Secrets
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
        run: |
          echo "${{ secrets.SPOTIFY_CLIENT_ID }}" | npx wrangler secret put SPOTIFY_CLIENT_ID
          echo "${{ secrets.SPOTIFY_CLIENT_SECRET }}" | npx wrangler secret put SPOTIFY_CLIENT_SECRET
          echo "Spotify secrets configured"

      - name: Set GitHub OAuth Secrets (Optional)
        if: ${{ secrets.GITHUB_OAUTH_CLIENT_ID != '' }}
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
        run: |
          echo "${{ secrets.GITHUB_OAUTH_CLIENT_ID }}" | npx wrangler secret put GITHUB_CLIENT_ID
          echo "${{ secrets.GITHUB_OAUTH_CLIENT_SECRET }}" | npx wrangler secret put GITHUB_CLIENT_SECRET
          echo "GitHub OAuth secrets configured"

      - name: Set Auth Mode
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
        run: |
          # If GitHub OAuth not provided, enable Spotify-only mode
          if [ -z "${{ secrets.GITHUB_OAUTH_CLIENT_ID }}" ]; then
            echo "true" | npx wrangler secret put SPOTIFY_ONLY_AUTH
            echo "Spotify-only auth mode enabled"
          else
            echo "false" | npx wrangler secret put SPOTIFY_ONLY_AUTH
            echo "GitHub + Spotify auth mode enabled"
          fi

      - name: Verify Configuration
        run: |
          sleep 5
          echo "## Secrets Configuration Complete" >> $GITHUB_STEP_SUMMARY
          echo "" >> $GITHUB_STEP_SUMMARY
          echo "| Secret | Status |" >> $GITHUB_STEP_SUMMARY
          echo "|--------|--------|" >> $GITHUB_STEP_SUMMARY
          echo "| SPOTIFY_CLIENT_ID | Set |" >> $GITHUB_STEP_SUMMARY
          echo "| SPOTIFY_CLIENT_SECRET | Set |" >> $GITHUB_STEP_SUMMARY
          if [ -n "${{ secrets.GITHUB_OAUTH_CLIENT_ID }}" ]; then
            echo "| GITHUB_CLIENT_ID | Set |" >> $GITHUB_STEP_SUMMARY
            echo "| GITHUB_CLIENT_SECRET | Set |" >> $GITHUB_STEP_SUMMARY
            echo "| Auth Mode | GitHub + Spotify |" >> $GITHUB_STEP_SUMMARY
          else
            echo "| Auth Mode | Spotify Only |" >> $GITHUB_STEP_SUMMARY
          fi
          echo "" >> $GITHUB_STEP_SUMMARY
          echo "Verify at: https://spotify.houstons.tech/setup" >> $GITHUB_STEP_SUMMARY
```

BACKLOG.md
```md
# Spotify Genre Sorter - Backlog

> **How to use**: Copy any task below and paste it to Claude when you have spare credits.
> Each task is self-contained with context so Claude can pick it up immediately.

---

## Priority: High (User-Facing Features)

### 1. Genre Caching in KV
```
Implement genre caching in Cloudflare KV to reduce Spotify API calls.

Context:
- Currently we fetch all liked tracks + all artists on every /api/genres call
- This is slow for large libraries and hits Spotify rate limits
- Cache structure: user_genres_{spotify_user_id} -> { genres, timestamp, trackCount }
- Cache TTL: 1 hour (user can force refresh)
- Files: src/routes/api.ts, src/lib/session.ts

Requirements:
- Add cache check before fetching from Spotify
- Add "last updated" indicator in UI
- Add manual refresh button
- Invalidate cache when user creates a playlist (library changed)
```

### 2. Progress Indicator for Large Libraries
```
Add real-time progress indicator when fetching genres for large libraries.

Context:
- Users with 1000+ liked songs see a spinner for 30+ seconds with no feedback
- Spotify API is paginated (50 tracks per request)
- We already have onProgress callback in getAllLikedTracks()
- Files: src/index.ts (frontend), src/lib/spotify.ts, src/routes/api.ts

Requirements:
- Show "Loading tracks... 150/2000" style progress
- Show artist fetching progress separately
- Use Server-Sent Events (SSE) or polling for real-time updates
- Swedish translation for progress messages
```

### 3. Playlist Naming Customisation
```
Let users customise playlist names before creation.

Context:
- Currently hardcoded as "{genre} (from Likes)"
- Users might want different formats or prefixes
- Files: src/index.ts (UI), src/routes/api.ts

Requirements:
- Add template input: "{genre} - My Collection" etc
- Preview what playlists will be named
- Remember preference in localStorage
- Swedish translation support
```

---

## Priority: Medium (Quality of Life)

### 4. Genre Filtering/Exclusion
```
Allow users to filter or exclude certain genres from results.

Context:
- Some users have 100+ genres, many are obscure sub-genres
- Would be nice to hide/exclude unwanted genres
- Files: src/index.ts

Requirements:
- Add "hide" button next to each genre
- Hidden genres saved in localStorage
- "Show hidden" toggle
- Bulk actions: hide all with <5 tracks, etc
```

### 5. Dark/Light Theme Toggle
```
Add proper theme toggle (currently dark-only).

Context:
- App is dark theme only
- Some users prefer light mode
- CSS variables already set up for theming
- Files: src/index.ts (CSS section)

Requirements:
- Add theme toggle button in header
- Save preference in localStorage
- Respect system preference (prefers-color-scheme)
- Swedish mode should still apply its blue/yellow on top
```

### 6. Mobile Responsive Improvements
```
Improve mobile experience.

Context:
- Basic responsive CSS exists but not optimised
- Genre cards too small on mobile
- Buttons hard to tap
- Files: src/index.ts (CSS section)

Requirements:
- Larger touch targets (44px minimum)
- Better genre card layout on mobile
- Sticky header with user info
- Bottom sheet for bulk actions on mobile
```

---

## Priority: Low (Nice to Have)

### 7. Export/Import Genre Data
```
Let users export their genre analysis as JSON/CSV.

Context:
- Users might want to analyse their music taste externally
- Could be useful for sharing/comparison
- Files: src/index.ts, src/routes/api.ts

Requirements:
- Export button that downloads JSON with all genre data
- Include track details, not just IDs
- CSV option for spreadsheet users
```

### 8. Genre Statistics Dashboard
```
Add a stats view showing music taste analysis.

Context:
- Users love seeing data about their listening habits
- We already have all the data, just not visualised
- Files: src/index.ts

Requirements:
- Top 10 genres pie chart (use simple CSS, no libraries)
- "Diversity score" - how spread out genres are
- Average genres per track
- Most common artist
```

### 9. Duplicate Playlist Detection
```
Warn if a genre playlist already exists.

Context:
- Users might accidentally create duplicate playlists
- Spotify API can check existing playlists
- Files: src/lib/spotify.ts, src/routes/api.ts

Requirements:
- Before creating, check if "{genre} (from Likes)" exists
- Show warning with options: skip, rename, or overwrite
- Batch creation should handle this per-genre
```

### 10. More Swedish Easter Eggs
```
Add more Swedish-themed Easter eggs for Heidi.

Context:
- Heidi loves ancient history and Swedish culture
- Current: three crowns, viking ship, snus button
- Files: src/index.ts

Ideas to implement:
- Midsommar theme in June (flowers, maypole)
- Swedish Chef mode (Bork bork bork!)
- Random Swedish facts tooltip
- Dalahäst (Dala horse) cursor in Swedish mode
- ABBA lyrics in loading messages
- Fika break reminder after 25 mins of use
```

---

## Technical Debt

### 11. Extract Embedded HTML/CSS/JS
```
Refactor index.ts to separate concerns.

Context:
- index.ts is 1400+ lines with embedded HTML, CSS, and JS
- Makes editing difficult
- Files: src/index.ts

Requirements:
- Move CSS to separate file (inlined at build time)
- Move frontend JS to separate file
- Use build step to combine (esbuild plugin?)
- Keep single-file deployment benefit
```

### 12. Add More Unit Tests
```
Expand test coverage.

Context:
- Currently have basic tests for spotify.ts, session.ts, api.ts
- Missing edge cases and error paths
- Files: tests/

Requirements:
- Test retry logic with mocked failures
- Test session expiry handling
- Test Swedish mode translations
- Test bulk playlist creation with partial failures
- Aim for 80%+ coverage
```

### 13. Add E2E Tests
```
Add end-to-end tests with Playwright or similar.

Context:
- No E2E tests currently
- OAuth flow is tricky to test
- Could use mock Spotify API

Requirements:
- Test login flow (mocked OAuth)
- Test genre loading and display
- Test playlist creation
- Test Swedish mode toggle
- Run in CI
```

---

## Documentation

### 14. API Documentation
```
Create OpenAPI/Swagger documentation for the API.

Context:
- No formal API docs
- Would help if anyone forks the project
- Files: create new docs/api.md or openapi.yaml

Requirements:
- Document all endpoints
- Include request/response examples
- Document error codes
- Add to README
```

### 15. Architecture Diagram
```
Create visual architecture documentation.

Context:
- Flow is: User → CF Worker → GitHub/Spotify OAuth → KV
- Would help understanding
- Files: README.md or docs/

Requirements:
- Mermaid diagram in README
- Show OAuth flow
- Show data flow for genre analysis
- Show KV storage usage
```

---

## How to Use This File

When you have spare Claude credits, just:

1. Pick a task number
2. Copy the code block content
3. Paste to Claude with "implement this"
4. Claude will have full context to start immediately

Example prompt:
```
Implement task #1 from my BACKLOG.md - Genre Caching in KV
```

---

*Last updated: 2025-11-29*
```

CLAUDE.md
```md
# Spotify Genre Sorter - Project Context

> This file provides Claude with full context about this project. Read this first.

## Project Overview

**Purpose**: Cloudflare Workers application that organises Spotify liked songs into genre-based playlists.

**Owner**: Built for personal use with Easter eggs dedicated to "Heidi" (Swedish theme).

**Status**: v1.0 deployed with Spotify-only auth, Hall of Fame, and Swedish Easter eggs.

## Tech Stack

| Component | Technology |
|-----------|------------|
| Runtime | Cloudflare Workers |
| Framework | Hono (lightweight web framework) |
| Language | TypeScript 5.6 |
| Storage | Cloudflare KV (sessions + user stats) |
| Auth | Spotify OAuth (primary) or GitHub + Spotify |
| CI/CD | GitHub Actions (lint, test, security, deploy) |
| Testing | Vitest |
| Package Manager | npm |

## Key Design Decisions

### Authentication Flow
Two modes supported:

**Spotify-Only Mode (Recommended)**:

1. User logs in directly with Spotify OAuth
2. Session stored in Cloudflare KV with 7-day expiry
3. User automatically registered in Hall of Fame

**GitHub + Spotify Mode** (for access control):

1. User logs in via GitHub OAuth (whitelist specific usernames)
2. User connects Spotify account
3. Session stored in Cloudflare KV with 7-day expiry

Set via `SPOTIFY_ONLY_AUTH=true` secret or auto-detected if GitHub OAuth not configured.

### Genre Analysis
- Spotify assigns genres to **artists**, not tracks
- We fetch liked songs → extract unique artists → get artist genres
- Aggregate genres across all tracks for user's library

### Deployment Pipeline
- **No CLOUDFLARE_ACCOUNT_ID needed** - auto-detected from API token
- DNS conflict detection before deployment (fails if record exists)
- Blue-green deployment: Staging → Verify → Production → Verify → DNS cutover
- Staging worker cleaned up after successful production deploy

## File Structure

```
spotify-genre-sorter/
├── .github/workflows/
│   ├── ci.yml              # Lint, typecheck, test, build on PR
│   ├── deploy.yml          # Full deployment pipeline
│   ├── secrets.yml         # Push secrets to Cloudflare
│   └── release.yml         # Auto changelog on version tags
├── scripts/
│   └── setup.mjs           # Interactive local setup wizard
├── src/
│   ├── index.ts            # Main app, UI, routes (includes embedded HTML/CSS/JS)
│   ├── types.ts            # TypeScript interfaces
│   ├── lib/
│   │   ├── github.ts       # GitHub OAuth helpers
│   │   ├── session.ts      # KV session management
│   │   └── spotify.ts      # Spotify API client
│   └── routes/
│       ├── api.ts          # /api/* endpoints (genres, playlists)
│       └── auth.ts         # /auth/* endpoints (OAuth flows)
├── tests/
│   ├── spotify.test.ts     # Spotify API and genre logic tests
│   ├── session.test.ts     # Session management tests
│   └── api.test.ts         # API response format tests
├── CLAUDE.md               # THIS FILE - project context
├── README.md               # User documentation
├── LICENSE                 # Personal use free, commercial requires license
├── package.json
├── tsconfig.json
├── vitest.config.ts        # Test configuration
├── wrangler.toml           # Cloudflare Workers config
├── cliff.toml              # Changelog generation config
└── .eslintrc.json
```

## Easter Eggs (Swedish Theme for Heidi)

The app has a hidden Swedish mode activated by clicking the "For Heidi" badge:

1. **Favicon**: Blue/yellow Swedish flag colours
2. **Heidi Badge**: Bottom-right corner, clickable
3. **Swedish Mode Toggle**:
   - Blue (#006AA7) and yellow (#FECC00) theme colours
   - Swedish translations for all UI text
   - Crown emoji in header
   - Viking ship loading animation
4. **Footer**: "Tack Heidi!" (Thanks Heidi!)

Heidi context: Blonde, blue eyes, loves ancient history - hence the Viking/historical touches.

## Spelling Convention

**Australian English** - use "organise", "colour", etc. (NOT American spelling)

## GitHub Actions Secrets Required

| Secret | Required | How to Get |
|--------|----------|------------|
| `CLOUDFLARE_API_TOKEN` | **Yes** | [Cloudflare Dashboard](https://dash.cloudflare.com/profile/api-tokens) → Create Token → "Edit Cloudflare Workers" template |
| `SPOTIFY_CLIENT_ID` | **Yes** | [Spotify Developer Dashboard](https://developer.spotify.com/dashboard) |
| `SPOTIFY_CLIENT_SECRET` | **Yes** | Same as above |
| `SPOTIFY_ONLY_AUTH` | No | Set to `true` for Spotify-only auth (auto-detected if GitHub OAuth not set) |
| `GITHUB_OAUTH_CLIENT_ID` | No | [GitHub OAuth Apps](https://github.com/settings/developers) - for access control |
| `GITHUB_OAUTH_CLIENT_SECRET` | No | Same as above |
| `SNYK_TOKEN` | No | Optional security scanning |

### API Token Permissions Needed
- `Account > Workers Scripts > Edit`
- `Account > Workers KV Storage > Edit`
- `Account > Account Settings > Read` (for auto-detection)
- `Zone > DNS > Edit` (if using custom domain)

## GitHub Variables (Optional)

| Variable | Description |
|----------|-------------|
| `CUSTOM_DOMAIN` | Your custom domain e.g., `spotify.example.com` |

## Deployment Commands

```bash
# Local development
npm install
npm run dev

# Testing
npm test              # Run all tests
npm run test:watch    # Watch mode
npm run test:coverage # With coverage

# Interactive setup (creates KV, configures secrets)
npm run setup

# Manual deploy
npm run deploy

# Lint & typecheck
npm run lint
npm run typecheck
```

## API Endpoints

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/` | GET | None | Main UI |
| `/health` | GET | None | Health check |
| `/setup` | GET | None | Check secrets configuration |
| `/session` | GET | None | Check session status |
| `/stats` | GET | None | User count + Hall of Fame |
| `/auth/github` | GET | None | Start GitHub OAuth |
| `/auth/github/callback` | GET | None | GitHub OAuth callback |
| `/auth/spotify` | GET | None/GitHub | Start Spotify OAuth |
| `/auth/spotify/callback` | GET | None | Spotify OAuth callback |
| `/auth/logout` | GET | Any | Clear session |
| `/api/me` | GET | Spotify | Get user info |
| `/api/genres` | GET | Spotify | Get all genres from liked songs |
| `/api/playlist` | POST | Spotify | Create single genre playlist |
| `/api/playlists/bulk` | POST | Spotify | Create multiple playlists |

## Common Tasks

### Add a new allowed GitHub user
Edit `src/index.ts`, find `ALLOWED_USERS` array, add username.

### Change session expiry
Edit `src/lib/session.ts`, modify `SESSION_TTL` (currently 7 days).

### Modify UI styling
All CSS is embedded in `src/index.ts` within the `getIndexHTML()` function.

### Add new Spotify scopes
Edit `src/routes/auth.ts`, modify `SPOTIFY_SCOPES` constant.

## Troubleshooting

### "No accounts found for this API token"
Your Cloudflare API token doesn't have `Account Settings > Read` permission.

### "Could not find DNS zone for domain"
Either the domain isn't in your Cloudflare account, or token lacks `Zone > Read`.

### "DNS CONFLICT" error
An existing DNS record exists for your custom domain. Either:
1. Delete it manually in Cloudflare dashboard
2. Re-run workflow with "Force DNS update" checked
3. Use a different subdomain

### Staging health check fails
The worker may not have the required secrets. Ensure OAuth credentials are set:
```bash
npx wrangler secret put GITHUB_CLIENT_ID
npx wrangler secret put GITHUB_CLIENT_SECRET
npx wrangler secret put SPOTIFY_CLIENT_ID
npx wrangler secret put SPOTIFY_CLIENT_SECRET
```

## OAuth App Setup

### GitHub OAuth App
1. Go to https://github.com/settings/developers
2. New OAuth App
3. Homepage URL: `https://your-worker.workers.dev`
4. Callback URL: `https://your-worker.workers.dev/auth/github/callback`

### Spotify Developer App
1. Go to https://developer.spotify.com/dashboard
2. Create App
3. Redirect URI: `https://your-worker.workers.dev/auth/spotify/callback`
4. Select "Web API" scope

## Version History

- **v1.1.0**: Security headers, retry logic for high availability, Australian English spelling
- **v1.0.0**: Hall of Fame, Spotify-only auth, Swedish Easter eggs
- **v0.1.0**: Initial build with full OAuth, genre analysis, playlist creation

## Recent Improvements

### Security Hardening

- Content Security Policy (CSP) headers
- HSTS, X-Frame-Options, X-Content-Type-Options
- Permissions-Policy restrictions

### High Availability

- Automatic retry with exponential backoff on API failures
- Rate limit handling with Retry-After header support
- Network error recovery

### Code Quality

- Australian English spelling throughout
- ESLint + TypeScript strict mode

## Notes for Future Development

- Consider caching genre data in KV to reduce Spotify API calls
- Could add playlist naming customisation
- Might add genre filtering/exclusion options
- Consider adding progress indicator for large libraries (pagination)

---

Last updated: 2025-11-29
```

cliff.toml
```toml
# git-cliff configuration for automated changelog generation

[changelog]
header = """
# Changelog

All notable changes to this project will be documented in this file.

"""
body = """
{% if version %}\
    ## [{{ version | trim_start_matches(pat="v") }}] - {{ timestamp | date(format="%Y-%m-%d") }}
{% else %}\
    ## [Unreleased]
{% endif %}\
{% for group, commits in commits | group_by(attribute="group") %}
    ### {{ group | striptags | trim | upper_first }}
    {% for commit in commits %}
        - {% if commit.scope %}**{{ commit.scope }}:** {% endif %}\
            {{ commit.message | upper_first }}\
            {% if commit.github.username %} by @{{ commit.github.username }}{% endif %}\
    {% endfor %}
{% endfor %}\n
"""
footer = """
---
*Generated with [git-cliff](https://github.com/orhun/git-cliff)*
"""
trim = true

[git]
conventional_commits = true
filter_unconventional = true
split_commits = false
commit_preprocessors = []
commit_parsers = [
    { message = "^feat", group = "Features" },
    { message = "^fix", group = "Bug Fixes" },
    { message = "^doc", group = "Documentation" },
    { message = "^perf", group = "Performance" },
    { message = "^refactor", group = "Refactoring" },
    { message = "^style", group = "Styling" },
    { message = "^test", group = "Testing" },
    { message = "^chore\\(release\\)", skip = true },
    { message = "^chore\\(deps.*\\)", skip = true },
    { message = "^chore\\(pr\\)", skip = true },
    { message = "^chore\\(pull\\)", skip = true },
    { message = "^chore|^ci", group = "Miscellaneous" },
    { body = ".*security", group = "Security" },
]
protect_breaking_commits = false
filter_commits = false
topo_order = false
sort_commits = "oldest"
```

LICENSE
```LICENSE
Spotify Genre Organiser License

Copyright (c) 2024

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to use,
copy, modify, and distribute the Software for personal, non-commercial purposes,
subject to the following conditions:

1. PERSONAL USE: You may use, copy, modify, and distribute this Software for
   personal, non-commercial purposes without restriction.

2. COMMERCIAL USE: Any commercial use of this Software, including but not
   limited to:
   - Using the Software as part of a paid service or product
   - Using the Software in a business context to generate revenue
   - Offering the Software as a service (SaaS) to paying customers
   - Including the Software in a commercial product

   Requires a separate commercial license. Contact the copyright holder to
   negotiate commercial licensing terms.

3. ATTRIBUTION: The above copyright notice and this permission notice shall be
   included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

README.md
```md
# Spotify Genre Sorter

[![Stars](https://img.shields.io/github/stars/TomsTech/spotify-genre-sorter?style=flat-square&logo=github&label=Stars&color=gold)](https://github.com/TomsTech/spotify-genre-sorter/stargazers)
[![CI](https://github.com/TomsTech/spotify-genre-sorter/actions/workflows/ci.yml/badge.svg)](https://github.com/TomsTech/spotify-genre-sorter/actions/workflows/ci.yml)
[![Deploy](https://github.com/TomsTech/spotify-genre-sorter/actions/workflows/deploy.yml/badge.svg)](https://github.com/TomsTech/spotify-genre-sorter/actions/workflows/deploy.yml)
[![Status](https://img.shields.io/badge/status-operational-brightgreen)](https://spotify.houstons.tech/health)
[![License: Personal Use](https://img.shields.io/badge/License-Personal%20Use-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue.svg)](https://www.typescriptlang.org/)
[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-orange.svg)](https://workers.cloudflare.com/)

Organise your Spotify liked songs into genre-based playlists with one click.

> *For Heidi x, hopefully you know why I disappear for so long, I'm just dicking my keyboard for countless hours instead*

## Quick Start

### TL;DR - What You Need

1. **Cloudflare account** with Workers enabled (free tier works)
2. **GitHub OAuth App** - for login
3. **Spotify Developer App** - for accessing your music
4. **5 minutes** to set it all up

---

## Complete Setup Guide

### Step 1: Fork & Clone

```bash
git clone https://github.com/TomsTech/spotify-genre-sorter.git
cd spotify-genre-sorter
npm install
```

### Step 2: Create Cloudflare API Token

You need this for GitHub Actions to deploy automatically.

1. Go to [Cloudflare API Tokens](https://dash.cloudflare.com/profile/api-tokens)
2. Click **Create Token**
3. Use **Edit Cloudflare Workers** template
4. Add these permissions:
   - `Account > Workers Scripts > Edit`
   - `Account > Workers KV Storage > Edit`
   - `Account > Account Settings > Read`
   - `Zone > DNS > Edit` (only if using custom domain)
5. Create token and **copy it**

### Step 3: Add Token to GitHub

1. Go to your repo → **Settings** → **Secrets and variables** → **Actions**
2. Click **New repository secret**
3. Name: `CLOUDFLARE_API_TOKEN`
4. Value: paste the token from Step 2

### Step 4: Create GitHub OAuth App

This lets users log in with their GitHub account.

1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Click **OAuth Apps** → **New OAuth App**
3. Fill in:

| Field | Value |
|-------|-------|
| Application name | `Spotify Genre Sorter` |
| Homepage URL | `https://spotify-genre-sorter.<your-subdomain>.workers.dev` |
| Authorization callback URL | `https://spotify-genre-sorter.<your-subdomain>.workers.dev/auth/github/callback` |

> **Find your subdomain**: Check your Cloudflare Workers dashboard - it's usually `<something>.workers.dev`. For example: `dev-playground-df5.workers.dev`

4. Click **Register application**
5. **Copy the Client ID** (you'll need this)
6. Click **Generate a new client secret** and **copy it immediately**

### Step 5: Create Spotify Developer App

This lets the app access your Spotify library.

1. Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Click **Create App**
3. Fill in:

| Field | Value |
|-------|-------|
| App name | `Spotify Genre Sorter` |
| App description | `Organise liked songs into genre playlists` |
| Redirect URI | `https://spotify-genre-sorter.<your-subdomain>.workers.dev/auth/spotify/callback` |

4. Check **Web API** under APIs
5. Click **Save**
6. Go to **Settings** → **copy Client ID and Client Secret**

### Step 6: Deploy the Worker

Push to GitHub to trigger the first deploy:

```bash
git push origin main
```

Wait for the GitHub Action to complete (check the Actions tab).

### Step 7: Set Worker Secrets (THE IMPORTANT BIT)

**This is where most people get stuck.** The secrets must be set on the Cloudflare Worker, NOT in GitHub.

Run these commands in your terminal:

```bash
# GitHub OAuth credentials
npx wrangler secret put GITHUB_CLIENT_ID
# Paste your GitHub Client ID when prompted

npx wrangler secret put GITHUB_CLIENT_SECRET
# Paste your GitHub Client Secret when prompted

# Spotify OAuth credentials
npx wrangler secret put SPOTIFY_CLIENT_ID
# Paste your Spotify Client ID when prompted

npx wrangler secret put SPOTIFY_CLIENT_SECRET
# Paste your Spotify Client Secret when prompted
```

Each command will prompt you to enter the value. It won't show what you type (that's normal - it's hidden for security).

### Step 8: Verify It Works

1. Visit `https://spotify-genre-sorter.<your-subdomain>.workers.dev/health`
   - Should show: `{"status":"ok"}`
2. Visit `https://spotify-genre-sorter.<your-subdomain>.workers.dev/setup`
   - Should show: `{"configured":true}`
   - If it shows missing secrets, go back to Step 7

---

## Custom Domain Setup (Optional)

Want to use your own domain like `spotify.example.com`?

### Option A: Via GitHub Actions (Recommended)

1. Go to your repo → **Settings** → **Variables** → **Actions**
2. Add variable: `CUSTOM_DOMAIN` = `spotify.example.com`
3. Run the Deploy workflow manually with "Force DNS update" checked

### Option B: Manual Setup

```bash
# Add the domain via Cloudflare dashboard
# Workers & Pages → your worker → Settings → Triggers → Custom Domains
```

**Important**: Update your OAuth callback URLs in both GitHub and Spotify apps to use the new domain!

---

## Troubleshooting

### "Worker returns error 1042"
The worker is crashing. Usually means secrets aren't set. Run:
```bash
npx wrangler secret list
```
Should show all 4 secrets. If not, set them with `npx wrangler secret put`.

### "/setup shows missing secrets but I set them"
Secrets are per-worker. Make sure you're setting them on the right worker:
```bash
npx wrangler secret put GITHUB_CLIENT_ID --name spotify-genre-sorter
```

### "redirect_uri_mismatch" error
Your OAuth callback URL doesn't match. Check:
1. The URL in your GitHub/Spotify app settings
2. Must match EXACTLY: `https://your-domain/auth/github/callback` or `/auth/spotify/callback`

### "DNS not resolving for custom domain"
DNS can take a few minutes to propagate. Try:
```bash
# Check if DNS is working
nslookup your-domain.com 8.8.8.8
```

### "Pipeline succeeds but site shows error"
The health check passed but OAuth isn't configured. Check `/setup` endpoint.

---

## How It Works

1. User logs in with GitHub (whitelist specific users if you want)
2. User connects their Spotify account
3. App fetches all liked songs
4. Extracts genres from artists (Spotify assigns genres to artists, not tracks)
5. User can create playlists for any genre

---

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `/` | Main UI |
| `/health` | Health check (returns `{"status":"ok"}`) |
| `/setup` | Check if secrets are configured |
| `/session` | Current session status |
| `/auth/github` | Start GitHub login |
| `/auth/spotify` | Connect Spotify |
| `/auth/logout` | Log out |
| `/api/genres` | Get all genres from liked songs |
| `/api/playlist` | Create a playlist |

---

## Testing

Run the test suite:

```bash
npm test              # Run all tests
npm run test:watch    # Watch mode
npm run test:coverage # With coverage report
```

Tests cover:

- Spotify OAuth URL generation
- Genre extraction and counting logic
- Playlist creation chunking
- Session management
- API response formats

---

## Local Development

Create a `.dev.vars` file:

```
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
SPOTIFY_CLIENT_ID=your_spotify_client_id
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret
```

Then:
```bash
npm run dev
```

Update OAuth callback URLs to `http://localhost:8787/auth/*/callback` for local testing.

---

## Architecture

```
User → Cloudflare Worker → GitHub OAuth (login)
                        → Spotify API (music data)
                        → KV Storage (sessions)
```

---

## Security

Your data and tokens are protected with industry best practices:

### Token Protection

| Measure | Description |
|---------|-------------|
| **Server-side only** | OAuth tokens stored in Cloudflare KV, never sent to browser |
| **HttpOnly cookies** | Session ID cookie cannot be accessed by JavaScript |
| **Secure flag** | Cookies only transmitted over HTTPS |
| **SameSite=Lax** | Prevents cross-site request forgery (CSRF) |
| **Single-use state** | OAuth state tokens deleted after verification |

### API Hardening

| Protection | Implementation |
|------------|----------------|
| **Rate limiting** | 30 requests/minute per IP (429 with Retry-After) |
| **CORS restriction** | Same-origin only - no cross-site API access |
| **Input validation** | Track IDs validated (22-char alphanumeric) |
| **Genre sanitisation** | Dangerous characters stripped, max 100 chars |
| **Request limits** | Max 10,000 tracks, 50 genres per bulk request |
| **Error sanitisation** | Internal details never exposed to clients |

### Security Headers

All responses include:

- `Content-Security-Policy` - strict source restrictions
- `X-Frame-Options: DENY` - prevents clickjacking
- `X-Content-Type-Options: nosniff` - prevents MIME sniffing
- `Strict-Transport-Security` - enforces HTTPS
- `Referrer-Policy` - limits referrer leakage
- `Permissions-Policy` - disables camera/microphone/geolocation

### CI/CD Security

- **CodeQL** analysis on every push
- **Snyk** vulnerability scanning
- **npm audit** for dependency checks

---

## Notes

- Genres come from **artists**, not individual tracks
- Large libraries take longer (paginated API calls)
- Playlists are created as **private** by default
- Session expires after 7 days

## License

Free for personal use. Commercial use requires a paid license — see [LICENSE](LICENSE).

---

<sub><img src="https://flagcdn.com/16x12/se.png" width="16" height="12" alt="SE"> *For Heidi*</sub>
```

scripts\setup.mjs
```mjs
#!/usr/bin/env node

/**
 * Interactive setup script for Spotify Genre Organiser
 * Automatically configures Cloudflare Workers, KV namespace, and custom domains
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { createInterface } from 'readline';

const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
});

const question = (prompt) =>
  new Promise((resolve) => rl.question(prompt, resolve));

const log = {
  info: (msg) => console.log(`\x1b[36m[INFO]\x1b[0m ${msg}`),
  success: (msg) => console.log(`\x1b[32m[SUCCESS]\x1b[0m ${msg}`),
  warn: (msg) => console.log(`\x1b[33m[WARN]\x1b[0m ${msg}`),
  error: (msg) => console.log(`\x1b[31m[ERROR]\x1b[0m ${msg}`),
  step: (msg) => console.log(`\n\x1b[35m▶\x1b[0m ${msg}`),
};

async function checkCloudflareAuth() {
  log.step('Checking Cloudflare authentication...');

  const apiToken = process.env.CLOUDFLARE_API_TOKEN;

  if (apiToken) {
    log.info('Using CLOUDFLARE_API_TOKEN from environment');
    return apiToken;
  }

  // Check if wrangler is logged in
  try {
    execSync('npx wrangler whoami', { stdio: 'pipe' });
    log.success('Authenticated via wrangler');
    return null; // Using wrangler auth
  } catch {
    log.warn('Not authenticated with Cloudflare');
    console.log('\nYou can authenticate in two ways:');
    console.log('1. Set CLOUDFLARE_API_TOKEN environment variable');
    console.log('2. Run: npx wrangler login\n');

    const choice = await question('Would you like to login with wrangler now? (y/n): ');
    if (choice.toLowerCase() === 'y') {
      execSync('npx wrangler login', { stdio: 'inherit' });
      return null;
    } else {
      log.error('Cloudflare authentication required');
      process.exit(1);
    }
  }
}

async function getAccountId(apiToken) {
  log.step('Fetching Cloudflare account ID...');

  if (apiToken) {
    const response = await fetch('https://api.cloudflare.com/client/v4/accounts', {
      headers: { Authorization: `Bearer ${apiToken}` },
    });
    const data = await response.json();
    if (!data.success || !data.result.length) {
      log.error('Failed to fetch accounts');
      process.exit(1);
    }

    if (data.result.length === 1) {
      log.success(`Using account: ${data.result[0].name}`);
      return data.result[0].id;
    }

    console.log('\nAvailable accounts:');
    data.result.forEach((acc, i) => console.log(`  ${i + 1}. ${acc.name} (${acc.id})`));
    const choice = await question('\nSelect account number: ');
    return data.result[parseInt(choice) - 1].id;
  }

  // Use wrangler to get account
  const output = execSync('npx wrangler whoami', { encoding: 'utf8' });
  const match = output.match(/Account ID[:\s]+([a-f0-9]{32})/i);
  if (match) {
    return match[1];
  }

  log.error('Could not determine account ID');
  process.exit(1);
}

async function createKVNamespace(apiToken, accountId) {
  log.step('Creating KV namespace...');

  const namespaceName = 'spotify-genre-organiser-sessions';

  try {
    // First check if it already exists
    const listCmd = apiToken
      ? `curl -s -X GET "https://api.cloudflare.com/client/v4/accounts/${accountId}/storage/kv/namespaces" -H "Authorization: Bearer ${apiToken}"`
      : 'npx wrangler kv:namespace list';

    const existingOutput = execSync(listCmd, { encoding: 'utf8' });

    if (existingOutput.includes(namespaceName)) {
      log.info('KV namespace already exists');
      const match = existingOutput.match(new RegExp(`"id":\\s*"([^"]+)"[^}]*"title":\\s*"${namespaceName}"`)) ||
                    existingOutput.match(new RegExp(`"title":\\s*"${namespaceName}"[^}]*"id":\\s*"([^"]+)"`));
      if (match) return match[1];
    }

    // Create namespace
    const createOutput = execSync(`npx wrangler kv:namespace create SESSIONS`, {
      encoding: 'utf8',
    });

    const idMatch = createOutput.match(/id\s*=\s*"([^"]+)"/);
    if (idMatch) {
      log.success(`Created KV namespace: ${idMatch[1]}`);
      return idMatch[1];
    }
  } catch (error) {
    log.error('Failed to create KV namespace: ' + error.message);
    process.exit(1);
  }
}

async function getDNSZones(apiToken, accountId) {
  log.step('Fetching available DNS zones...');

  const url = `https://api.cloudflare.com/client/v4/zones?account.id=${accountId}&status=active`;
  const headers = apiToken
    ? { Authorization: `Bearer ${apiToken}` }
    : { Authorization: `Bearer ${execSync('npx wrangler config get oauth_token', { encoding: 'utf8' }).trim()}` };

  try {
    const response = await fetch(url, { headers });
    const data = await response.json();

    if (!data.success) {
      log.warn('Could not fetch DNS zones. You may need to configure custom domain manually.');
      return [];
    }

    return data.result.map((zone) => ({
      id: zone.id,
      name: zone.name,
      status: zone.status,
    }));
  } catch (error) {
    log.warn('Could not fetch DNS zones: ' + error.message);
    return [];
  }
}

async function configureCustomDomain(zones) {
  if (zones.length === 0) {
    const useCustom = await question('\nWould you like to configure a custom domain? (y/n): ');
    if (useCustom.toLowerCase() !== 'y') {
      return null;
    }
    const domain = await question('Enter your full custom domain (e.g., spotify.example.com): ');
    return { domain, zoneId: null };
  }

  console.log('\n📍 Available DNS zones:');
  zones.forEach((zone, i) => console.log(`  ${i + 1}. ${zone.name}`));
  console.log(`  ${zones.length + 1}. Skip custom domain (use workers.dev)`);

  const choice = await question('\nSelect zone number: ');
  const index = parseInt(choice) - 1;

  if (index === zones.length) {
    return null;
  }

  const selectedZone = zones[index];
  const subdomain = await question(`Enter subdomain for ${selectedZone.name} (e.g., spotify): `);
  const fullDomain = subdomain ? `${subdomain}.${selectedZone.name}` : selectedZone.name;

  return {
    domain: fullDomain,
    zoneId: selectedZone.id,
    zoneName: selectedZone.name,
  };
}

async function collectSecrets() {
  log.step('Collecting application secrets...');
  console.log('\nYou\'ll need OAuth credentials from GitHub and Spotify.\n');

  const secrets = {};

  console.log('GitHub OAuth App: https://github.com/settings/developers');
  secrets.GITHUB_CLIENT_ID = await question('GitHub Client ID: ');
  secrets.GITHUB_CLIENT_SECRET = await question('GitHub Client Secret: ');

  console.log('\nSpotify Developer App: https://developer.spotify.com/dashboard');
  secrets.SPOTIFY_CLIENT_ID = await question('Spotify Client ID: ');
  secrets.SPOTIFY_CLIENT_SECRET = await question('Spotify Client Secret: ');

  const allowedUsers = await question('\nAllowed GitHub usernames (comma-separated, or empty for all): ');
  secrets.ALLOWED_GITHUB_USERS = allowedUsers;

  return secrets;
}

function updateWranglerConfig(kvNamespaceId, customDomain, accountId) {
  log.step('Updating wrangler.toml...');

  let config = readFileSync('wrangler.toml', 'utf8');

  // Update KV namespace ID
  config = config.replace(
    /id = "YOUR_KV_NAMESPACE_ID"/,
    `id = "${kvNamespaceId}"`
  );

  // Add custom domain route if configured
  if (customDomain) {
    const routeConfig = `
# Custom domain configuration
routes = [
  { pattern = "${customDomain}", custom_domain = true }
]
`;
    if (!config.includes('routes =')) {
      config += routeConfig;
    }
  }

  writeFileSync('wrangler.toml', config);
  log.success('Updated wrangler.toml');
}

async function setSecrets(secrets) {
  log.step('Setting worker secrets...');

  for (const [key, value] of Object.entries(secrets)) {
    if (value && key !== 'ALLOWED_GITHUB_USERS') {
      try {
        execSync(`echo "${value}" | npx wrangler secret put ${key}`, {
          stdio: 'pipe',
        });
        log.success(`Set secret: ${key}`);
      } catch {
        log.warn(`Failed to set ${key} - you may need to set it manually`);
      }
    }
  }
}

function createEnvFile(secrets, customDomain) {
  log.step('Creating .dev.vars for local development...');

  const workerUrl = customDomain || 'http://localhost:8787';

  const envContent = `# Local development environment variables
# Copy this file and fill in your values

GITHUB_CLIENT_ID=${secrets.GITHUB_CLIENT_ID || 'your_github_client_id'}
GITHUB_CLIENT_SECRET=${secrets.GITHUB_CLIENT_SECRET || 'your_github_client_secret'}
SPOTIFY_CLIENT_ID=${secrets.SPOTIFY_CLIENT_ID || 'your_spotify_client_id'}
SPOTIFY_CLIENT_SECRET=${secrets.SPOTIFY_CLIENT_SECRET || 'your_spotify_client_secret'}
ALLOWED_GITHUB_USERS=${secrets.ALLOWED_GITHUB_USERS || ''}

# For local development, update your OAuth apps to use:
# Homepage URL: http://localhost:8787
# Callback URL: http://localhost:8787/auth/github/callback (GitHub)
# Redirect URI: http://localhost:8787/auth/spotify/callback (Spotify)
`;

  writeFileSync('.dev.vars', envContent);
  log.success('Created .dev.vars');
}

function generateGitHubActionsConfig(customDomain) {
  log.step('Updating GitHub Actions configuration...');

  if (customDomain) {
    // Create/update repository variables file
    const varsContent = `# Add these as repository variables in GitHub Settings > Secrets and variables > Actions

WORKER_URL=${customDomain}
`;
    writeFileSync('.github/SETUP_VARS.md', varsContent);
    log.info('Created .github/SETUP_VARS.md with required variables');
  }
}

async function main() {
  console.log('\n🎵 Spotify Genre Organiser - Setup\n');
  console.log('This script will configure your Cloudflare Worker deployment.\n');

  // Check dependencies
  if (!existsSync('package.json')) {
    log.error('Please run this script from the project root directory');
    process.exit(1);
  }

  // Authenticate
  const apiToken = await checkCloudflareAuth();
  const accountId = await getAccountId(apiToken);

  // Create KV namespace
  const kvNamespaceId = await createKVNamespace(apiToken, accountId);

  // Get DNS zones and configure custom domain
  const zones = await getDNSZones(apiToken, accountId);
  const customDomain = await configureCustomDomain(zones);

  // Collect secrets
  const secrets = await collectSecrets();

  // Update configuration files
  updateWranglerConfig(kvNamespaceId, customDomain?.domain, accountId);

  // Set secrets in Cloudflare
  const setSecretsNow = await question('\nSet secrets in Cloudflare now? (y/n): ');
  if (setSecretsNow.toLowerCase() === 'y') {
    await setSecrets(secrets);
  }

  // Create local env file
  createEnvFile(secrets, customDomain?.domain);

  // Generate GitHub Actions config
  generateGitHubActionsConfig(customDomain?.domain);

  console.log('\n' + '='.repeat(60));
  log.success('Setup complete!');
  console.log('='.repeat(60));

  console.log('\n📋 Next steps:\n');

  const deployUrl = customDomain?.domain || 'your-worker.workers.dev';

  console.log('1. Update your OAuth apps with the correct URLs:');
  console.log(`   GitHub callback: https://${deployUrl}/auth/github/callback`);
  console.log(`   Spotify redirect: https://${deployUrl}/auth/spotify/callback\n`);

  console.log('2. Add GitHub repository secrets:');
  console.log('   - CLOUDFLARE_API_TOKEN');
  console.log('   - CLOUDFLARE_ACCOUNT_ID\n');

  console.log('3. Deploy:');
  console.log('   npm run deploy\n');

  console.log('4. Or push to main branch to trigger CI/CD pipeline\n');

  rl.close();
}

main().catch((error) => {
  log.error(error.message);
  process.exit(1);
});
```

src\index.ts
```ts
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import auth from './routes/auth';
import api from './routes/api';
import { getSession } from './lib/session';

const app = new Hono<{ Bindings: Env }>();

// Global error handler
app.onError((err, c) => {
  console.error('Worker error:', err);
  return c.json({ error: err.message || 'Internal error' }, 500);
});

// Security headers middleware - fixes Google Safe Browsing warnings
app.use('*', async (c, next) => {
  await next();
  c.header('Content-Security-Policy', [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https://flagcdn.com https://i.scdn.co https://avatars.githubusercontent.com",
    "connect-src 'self' https://api.spotify.com https://ko-fi.com",
    "frame-ancestors 'none'",
  ].join('; '));
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('X-Frame-Options', 'DENY');
  c.header('X-XSS-Protection', '1; mode=block');
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  c.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  c.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
});

// Health check - FIRST route, no middleware dependency
app.get('/health', (c) => {
  return c.json({ status: 'ok' });
});

// Middleware (after health check so it doesn't block health)
app.use('*', logger());

// CORS - restrict to same-origin only (no cross-origin API access)
// This prevents malicious sites from making requests on behalf of users
app.use('/api/*', cors({
  origin: (origin, c) => {
    // Allow same-origin requests (origin will be null for same-origin)
    // or match the request host
    const host = c.req.header('host');
    if (!origin || origin.includes(host || '')) {
      return origin || '*';
    }
    return null; // Reject cross-origin
  },
  credentials: true,
}));

// Mount routes
app.route('/auth', auth);
app.route('/api', api);

// Setup check - verifies required secrets are configured
app.get('/setup', (c) => {
  const missing: string[] = [];
  const spotifyOnly = c.env.SPOTIFY_ONLY_AUTH === 'true' || !c.env.GITHUB_CLIENT_ID;

  // GitHub secrets only required if not in Spotify-only mode
  if (!spotifyOnly) {
    if (!c.env.GITHUB_CLIENT_ID) missing.push('GITHUB_CLIENT_ID');
    if (!c.env.GITHUB_CLIENT_SECRET) missing.push('GITHUB_CLIENT_SECRET');
  }

  // Spotify secrets always required
  if (!c.env.SPOTIFY_CLIENT_ID) missing.push('SPOTIFY_CLIENT_ID');
  if (!c.env.SPOTIFY_CLIENT_SECRET) missing.push('SPOTIFY_CLIENT_SECRET');
  if (!c.env.SESSIONS) missing.push('SESSIONS (KV namespace)');

  if (missing.length > 0) {
    return c.json({
      configured: false,
      missing,
      authMode: spotifyOnly ? 'spotify-only' : 'github+spotify',
      message: 'Set secrets via: npx wrangler secret put SECRET_NAME'
    }, 503);
  }
  return c.json({
    configured: true,
    authMode: spotifyOnly ? 'spotify-only' : 'github+spotify',
  });
});

// Session status endpoint
app.get('/session', async (c) => {
  // Check if KV is configured
  if (!c.env.SESSIONS) {
    return c.json({ authenticated: false, error: 'KV not configured' });
  }

  const spotifyOnly = c.env.SPOTIFY_ONLY_AUTH === 'true' || !c.env.GITHUB_CLIENT_ID;

  try {
    const session = await getSession(c);
    if (!session) {
      return c.json({ authenticated: false, spotifyOnly });
    }

    // In Spotify-only mode, user is authenticated once Spotify is connected
    const isAuthenticated = spotifyOnly
      ? !!session.spotifyAccessToken
      : !!session.githubUser;

    return c.json({
      authenticated: isAuthenticated,
      spotifyOnly,
      // User info (prefer Spotify in spotify-only mode)
      user: spotifyOnly ? session.spotifyUser : session.githubUser,
      avatar: spotifyOnly ? session.spotifyAvatar : session.githubAvatar,
      // Legacy fields for compatibility
      githubUser: session.githubUser,
      githubAvatar: session.githubAvatar,
      spotifyUser: session.spotifyUser,
      spotifyConnected: !!session.spotifyAccessToken,
    });
  } catch {
    return c.json({ authenticated: false, spotifyOnly, error: 'Session error' });
  }
});

// Stats endpoint - user count and hall of fame (public, no auth)
app.get('/stats', async (c) => {
  try {
    const countStr = await c.env.SESSIONS.get('stats:user_count');
    const count = countStr ? parseInt(countStr, 10) : 0;

    // Get hall of fame (first 10 users for display)
    const hallOfFame: { position: number; spotifyName: string; registeredAt: string }[] = [];
    for (let i = 1; i <= Math.min(count, 10); i++) {
      const hofKey = `hof:${String(i).padStart(3, '0')}`;
      const data = await c.env.SESSIONS.get(hofKey);
      if (data) {
        const entry = JSON.parse(data) as { position: number; spotifyName: string; registeredAt: string };
        hallOfFame.push({
          position: entry.position,
          spotifyName: entry.spotifyName,
          registeredAt: entry.registeredAt,
        });
      }
    }

    return c.json({
      userCount: count,
      launchDate: '2025-11-28',
      hallOfFame,
    });
  } catch {
    return c.json({ userCount: 0, hallOfFame: [] });
  }
});

// Swedish-themed favicon (Spotify logo in Swedish colours)
app.get('/favicon.svg', (c) => {
  c.header('Content-Type', 'image/svg+xml');
  return c.body(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
  <defs>
    <linearGradient id="swedish" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#006AA7"/>
      <stop offset="50%" style="stop-color:#FECC00"/>
      <stop offset="100%" style="stop-color:#006AA7"/>
    </linearGradient>
  </defs>
  <circle cx="12" cy="12" r="10" fill="url(#swedish)"/>
  <path fill="#fff" d="M16.586 16.424a.622.622 0 01-.857.207c-2.348-1.435-5.304-1.76-8.785-.964a.622.622 0 01-.277-1.215c3.809-.87 7.076-.496 9.712 1.115.293.18.386.563.207.857zm1.223-2.722a.78.78 0 01-1.072.257c-2.687-1.652-6.785-2.131-9.965-1.166a.78.78 0 01-.973-.519.781.781 0 01.52-.972c3.632-1.102 8.147-.568 11.233 1.329a.78.78 0 01.257 1.071zm.105-2.835c-3.223-1.914-8.54-2.09-11.618-1.156a.935.935 0 11-.543-1.79c3.533-1.072 9.404-.865 13.115 1.338a.935.935 0 11-.954 1.608z"/>
</svg>`);
});

// PNG favicon (Swedish Spotify logo from favicon_io)
app.get('/favicon.png', (c) => {
  c.header('Content-Type', 'image/png');
  c.header('Cache-Control', 'public, max-age=31536000');
  // Base64 decoded at runtime - Swedish-themed Spotify logo
  const base64 = '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';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return c.body(bytes);
});

// ICO favicon redirect
app.get('/favicon.ico', (c) => {
  return c.redirect('/favicon.png');
});

// Main UI
app.get('/', (c) => {
  return c.html(getHtml());
});

function getHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Spotify Genre Sorter</title>
  <link rel="icon" type="image/png" href="/favicon.png">
  <link rel="icon" type="image/svg+xml" href="/favicon.svg">
  <style>
    :root {
      --bg: #0a0a0a;
      --surface: #141414;
      --surface-2: #1e1e1e;
      --border: #2a2a2a;
      --text: #fafafa;
      --text-muted: #888;
      --accent: #1DB954;
      --accent-hover: #1ed760;
      --danger: #e74c3c;
      --swedish-blue: #006AA7;
      --swedish-yellow: #FECC00;
    }

    body.swedish-mode {
      --accent: #006AA7;
      --accent-hover: #0077b6;
      --bg: #001428;
      --surface: #002244;
      --surface-2: #003366;
      --border: #004488;
    }

    body.swedish-mode .stat-value {
      background: linear-gradient(135deg, var(--swedish-blue), var(--swedish-yellow));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }

    body.swedish-mode .btn-primary {
      background: linear-gradient(135deg, var(--swedish-blue), var(--swedish-yellow));
    }

    body.swedish-mode header h1 svg {
      fill: url(#swedish-grad);
    }

    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: var(--bg);
      color: var(--text);
      min-height: 100vh;
      line-height: 1.6;
      transition: all 0.3s ease;
    }

    .container {
      max-width: 900px;
      margin: 0 auto;
      padding: 2rem;
    }

    header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 3rem;
      padding-bottom: 1.5rem;
      border-bottom: 1px solid var(--border);
    }

    h1 {
      font-size: 1.5rem;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .user-info {
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    .avatar {
      width: 36px;
      height: 36px;
      border-radius: 50%;
    }

    .btn {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.625rem 1.25rem;
      border-radius: 6px;
      border: none;
      font-size: 0.875rem;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.15s ease;
      text-decoration: none;
    }

    .btn-primary {
      background: var(--accent);
      color: #000;
    }

    .btn-primary:hover {
      background: var(--accent-hover);
    }

    .btn-secondary {
      background: var(--surface-2);
      color: var(--text);
      border: 1px solid var(--border);
    }

    .btn-secondary:hover {
      background: var(--border);
    }

    .btn-ghost {
      background: transparent;
      color: var(--text-muted);
    }

    .btn-ghost:hover {
      color: var(--text);
    }

    .btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 1.5rem;
      margin-bottom: 1.5rem;
    }

    .card-title {
      font-size: 1rem;
      font-weight: 600;
      margin-bottom: 1rem;
    }

    .stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 1rem;
      margin-bottom: 1.5rem;
    }

    .stat {
      background: var(--surface-2);
      padding: 1rem;
      border-radius: 6px;
      text-align: center;
    }

    .stat-value {
      font-size: 1.75rem;
      font-weight: 700;
      color: var(--accent);
    }

    .stat-label {
      font-size: 0.75rem;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .genre-list {
      display: grid;
      gap: 0.5rem;
      max-height: 500px;
      overflow-y: auto;
    }

    .genre-item {
      display: flex;
      align-items: center;
      gap: 1rem;
      padding: 0.75rem 1rem;
      background: var(--surface-2);
      border-radius: 6px;
      transition: background 0.15s ease;
    }

    .genre-item:hover {
      background: var(--border);
    }

    .genre-checkbox {
      width: 18px;
      height: 18px;
      accent-color: var(--accent);
    }

    .genre-name {
      flex: 1;
      font-size: 0.9rem;
    }

    .genre-count {
      font-size: 0.8rem;
      color: var(--text-muted);
      background: var(--surface);
      padding: 0.25rem 0.5rem;
      border-radius: 4px;
    }

    .genre-create {
      opacity: 0;
      transition: opacity 0.15s ease;
    }

    .genre-item:hover .genre-create {
      opacity: 1;
    }

    .actions {
      display: flex;
      gap: 1rem;
      margin-top: 1.5rem;
      padding-top: 1.5rem;
      border-top: 1px solid var(--border);
    }

    .loading {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 3rem;
      color: var(--text-muted);
    }

    .spinner {
      width: 32px;
      height: 32px;
      border: 3px solid var(--border);
      border-top-color: var(--accent);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      margin-bottom: 1rem;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .loading-sub {
      font-size: 0.85rem;
      color: var(--text-muted);
      margin-top: 0.5rem;
      opacity: 0.7;
    }

    .error {
      background: rgba(231, 76, 60, 0.1);
      border: 1px solid var(--danger);
      color: var(--danger);
      padding: 1rem;
      border-radius: 6px;
      margin-bottom: 1rem;
      text-align: center;
    }

    .error strong {
      display: block;
      margin-bottom: 0.5rem;
    }

    .error p {
      margin: 0.5rem 0;
    }

    .error-detail {
      font-size: 0.8rem;
      opacity: 0.8;
      font-family: monospace;
    }

    .success {
      background: rgba(29, 185, 84, 0.1);
      border: 1px solid var(--accent);
      color: var(--accent);
      padding: 1rem;
      border-radius: 6px;
      margin-bottom: 1rem;
    }

    .welcome {
      text-align: center;
      padding: 4rem 2rem;
    }

    .welcome h2 {
      font-size: 2rem;
      margin-bottom: 1rem;
    }

    .welcome p {
      color: var(--text-muted);
      margin-bottom: 2rem;
      max-width: 400px;
      margin-left: auto;
      margin-right: auto;
    }

    .search-input {
      width: 100%;
      padding: 0.75rem 1rem;
      background: var(--surface-2);
      border: 1px solid var(--border);
      border-radius: 6px;
      color: var(--text);
      font-size: 0.9rem;
      margin-bottom: 1rem;
    }

    .search-input:focus {
      outline: none;
      border-color: var(--accent);
    }

    .search-input::placeholder {
      color: var(--text-muted);
    }

    .results {
      margin-top: 1rem;
    }

    .result-item {
      display: flex;
      justify-content: space-between;
      padding: 0.5rem 0;
      border-bottom: 1px solid var(--border);
    }

    .result-item:last-child {
      border-bottom: none;
    }

    .result-success {
      color: var(--accent);
    }

    .result-error {
      color: var(--danger);
    }

    /* Heidi Easter Egg Badge */
    .heidi-badge {
      position: fixed;
      bottom: 1rem;
      right: 1rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem 0.75rem;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 20px;
      font-size: 0.7rem;
      color: var(--text-muted);
      cursor: pointer;
      transition: all 0.3s ease;
      z-index: 100;
      opacity: 0.6;
    }

    .heidi-badge:hover {
      opacity: 1;
      transform: scale(1.05);
      border-color: var(--swedish-yellow);
      box-shadow: 0 0 20px rgba(254, 204, 0, 0.2);
    }

    .heidi-badge svg {
      width: 20px;
      height: 20px;
    }

    .heidi-badge .heidi-text {
      display: flex;
      flex-direction: column;
      line-height: 1.2;
    }

    .heidi-badge .heart {
      color: #e74c3c;
      animation: pulse 1.5s ease infinite;
    }

    @keyframes pulse {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.1); }
    }

    body.swedish-mode .heidi-badge {
      background: linear-gradient(135deg, var(--swedish-blue), var(--swedish-yellow));
      color: #fff;
      opacity: 1;
    }

    /* Swedish mode decorations - Three Crowns (Tre Kronor) */
    .swedish-crowns {
      display: none;
      position: absolute;
      top: -20px;
      right: 10px;
      font-size: 1.2rem;
    }

    body.swedish-mode .swedish-crowns {
      display: flex;
      gap: 0.25rem;
    }

    .swedish-crowns .crown {
      animation: float 2s ease-in-out infinite;
    }

    .swedish-crowns .crown:nth-child(1) {
      animation-delay: 0s;
    }

    .swedish-crowns .crown:nth-child(2) {
      animation-delay: 0.3s;
      font-size: 1.4rem;
      margin-top: -3px;
    }

    .swedish-crowns .crown:nth-child(3) {
      animation-delay: 0.6s;
    }

    @keyframes float {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-5px); }
    }

    .viking-ship {
      display: none;
      position: fixed;
      bottom: 60px;
      left: -100px;
      font-size: 2rem;
      animation: sail 15s linear infinite;
    }

    body.swedish-mode .viking-ship {
      display: block;
    }

    @keyframes sail {
      0% { left: -100px; }
      100% { left: calc(100% + 100px); }
    }

    /* User counter */
    .user-counter {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem 1rem;
      background: var(--surface-2);
      border-radius: 20px;
      font-size: 0.75rem;
      color: var(--text-muted);
    }

    .user-counter .count {
      color: var(--accent);
      font-weight: 700;
    }

    /* Swedish mode user counter */
    body.swedish-mode .user-counter {
      background: linear-gradient(135deg, var(--swedish-blue), #004d7a);
      color: #fff;
    }

    body.swedish-mode .user-counter .count {
      color: var(--swedish-yellow);
    }

    /* Swedish mode Hall of Fame */
    body.swedish-mode .hall-of-fame h3 {
      color: var(--swedish-yellow);
    }

    body.swedish-mode .hof-entry {
      background: linear-gradient(135deg, var(--swedish-blue), #004d7a);
      color: #fff;
    }

    /* Hall of Fame */
    .hall-of-fame {
      margin-top: 2rem;
      padding-top: 1.5rem;
      border-top: 1px solid var(--border);
    }

    .hall-of-fame h3 {
      font-size: 0.9rem;
      margin-bottom: 1rem;
      color: var(--text-muted);
    }

    .hof-list {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
    }

    .hof-entry {
      display: flex;
      align-items: center;
      gap: 0.25rem;
      padding: 0.25rem 0.5rem;
      background: var(--surface-2);
      border-radius: 4px;
      font-size: 0.7rem;
    }

    .hof-entry .position {
      color: var(--swedish-yellow);
      font-weight: 700;
    }

    /* Donation button - Aussie style */
    .durry-btn {
      position: fixed;
      bottom: 1rem;
      left: 1rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem 0.75rem;
      background: linear-gradient(135deg, #8B4513, #D2691E);
      border: none;
      border-radius: 20px;
      font-size: 0.7rem;
      color: #fff;
      cursor: pointer;
      transition: all 0.3s ease;
      text-decoration: none;
      z-index: 100;
      opacity: 0.8;
    }

    .durry-btn:hover {
      opacity: 1;
      transform: scale(1.05);
      box-shadow: 0 0 15px rgba(210, 105, 30, 0.4);
    }

    .durry-btn .icon {
      animation: smoke 2s ease-in-out infinite;
    }

    @keyframes smoke {
      0%, 100% { opacity: 0.5; transform: translateY(0); }
      50% { opacity: 1; transform: translateY(-2px); }
    }

    /* Swedish mode snus styling */
    body.swedish-mode .durry-btn {
      background: linear-gradient(135deg, var(--swedish-blue), #004d7a);
    }

    body.swedish-mode .durry-btn:hover {
      box-shadow: 0 0 15px rgba(0, 106, 167, 0.4);
    }

    /* Footer badges */
    .footer-badges {
      display: flex;
      gap: 0.5rem;
      margin-top: 2rem;
      flex-wrap: wrap;
      justify-content: center;
    }

    .footer-badges a {
      opacity: 0.7;
      transition: opacity 0.2s;
    }

    .footer-badges a:hover {
      opacity: 1;
    }
  </style>
</head>
<body>
  <!-- SVG Gradient Definition for Swedish mode -->
  <svg style="position:absolute;width:0;height:0;">
    <defs>
      <linearGradient id="swedish-grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:#006AA7"/>
        <stop offset="50%" style="stop-color:#FECC00"/>
        <stop offset="100%" style="stop-color:#006AA7"/>
      </linearGradient>
    </defs>
  </svg>

  <!-- Viking ship Easter egg (only in Swedish mode) -->
  <div class="viking-ship" title="Vikingaskepp!">⛵</div>

  <div class="container">
    <header style="position: relative;">
      <h1>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm4.586 14.424a.622.622 0 01-.857.207c-2.348-1.435-5.304-1.76-8.785-.964a.622.622 0 01-.277-1.215c3.809-.87 7.076-.496 9.712 1.115.293.18.386.563.207.857zm1.223-2.722a.78.78 0 01-1.072.257c-2.687-1.652-6.785-2.131-9.965-1.166a.78.78 0 01-.973-.519.781.781 0 01.52-.972c3.632-1.102 8.147-.568 11.233 1.329a.78.78 0 01.257 1.071zm.105-2.835c-3.223-1.914-8.54-2.09-11.618-1.156a.935.935 0 11-.543-1.79c3.533-1.072 9.404-.865 13.115 1.338a.935.935 0 11-.954 1.608z"/>
        </svg>
        <span data-i18n="title">Genre Sorter</span>
      </h1>
      <span class="swedish-crowns" title="Tre Kronor - Three Crowns of Sweden">
        <span class="crown">👑</span>
        <span class="crown">👑</span>
        <span class="crown">👑</span>
      </span>
      <div id="header-actions"></div>
    </header>

    <main id="app">
      <div class="loading">
        <div class="spinner"></div>
        <span data-i18n="loading">Loading...</span>
      </div>
    </main>
  </div>

  <!-- Shout me a durry button (Aussie style) / Snus button (Swedish mode) -->
  <a href="https://buymeacoffee.com/tomstech" target="_blank" class="durry-btn" id="donation-btn" title="Chuck us a dart, legend">
    <span class="icon">🚬</span>
    <span class="text">Shout me a durry</span>
  </a>

  <!-- Heidi Easter Egg Badge -->
  <div class="heidi-badge" onclick="toggleSwedishMode()" title="Click for a Swedish surprise!">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="12" cy="8" r="4"/>
      <path d="M4 20c0-4 4-6 8-6s8 2 8 6"/>
      <path d="M9 4c1-2 5-2 6 0" stroke="#FECC00"/>
    </svg>
    <span class="heidi-text">
      <span>Made with inspiration from</span>
      <span><strong>Heidi</strong> <span class="heart">♥</span></span>
    </span>
  </div>

  <script>
    const app = document.getElementById('app');
    const headerActions = document.getElementById('header-actions');

    let genreData = null;
    let selectedGenres = new Set();
    let swedishMode = localStorage.getItem('swedishMode') === 'true';
    let spotifyOnlyMode = false;
    let statsData = null;

    // Swedish anthem sound (short piano melody in base64 - plays "Du gamla, Du fria" opening)
    const swedishChime = 'data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//tQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAABhgC7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7//////////////////////////////////////////////////////////////////8AAAAATGF2YzU4LjEzAAAAAAAAAAAAAAAAJAAAAAAAAAAAAYZNYW9jAAAAAAAAAAAAAAAAAAAAAP/7kGQAAAAAADSAAAAAAAAANIAAAAAETEFNRTMuMTAwVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVX/+5JkDw/wAABpAAAACAAADSAAAAEAAAGkAAAAIAAANIAAAARVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV';


    // Swedish translations
    const i18n = {
      en: {
        title: 'Genre Sorter',
        loading: 'Loading...',
        organiseMusic: 'Organise Your Music',
        organiseDesc: 'Automatically sort your Spotify liked songs into genre-based playlists with one click.',
        signInGithub: 'Sign in with GitHub',
        connectSpotify: 'Connect Your Spotify',
        connectDesc: 'Connect your Spotify account to analyse your liked songs and organise them by genre.',
        connectBtn: 'Connect Spotify',
        fetchingGenres: 'Fetching your liked songs and genres...',
        likedSongs: 'Liked Songs',
        genresFound: 'Genres Found',
        selected: 'Selected',
        yourGenres: 'Your Genres',
        searchGenres: 'Search genres...',
        selectAll: 'Select All',
        selectNone: 'Select None',
        createPlaylists: 'Create Playlists',
        create: 'Create',
        creating: 'Creating...',
        created: 'Created!',
        failed: 'Failed',
        results: 'Results',
        successCreated: 'Successfully created',
        of: 'of',
        playlists: 'playlists',
        openSpotify: 'Open in Spotify',
        logout: 'Logout',
        errorLoad: 'Failed to load your genres. Please try refreshing the page.',
        refresh: 'Refresh',
        tracks: 'tracks',
        errorGithubDenied: 'GitHub authorization was denied.',
        errorNotAllowed: 'Your GitHub account is not authorised to use this app.',
        errorAuthFailed: 'Authentication failed. Please try again.',
        errorInvalidState: 'Invalid state. Please try again.',
        hallOfFame: 'First Users - Hall of Fame',
        musicLoversJoined: 'music lovers have joined',
        signInSpotify: 'Sign in with Spotify',
      },
      sv: {
        title: 'Genresorterare',
        loading: 'Laddar...',
        organiseMusic: 'Organisera Din Musik',
        organiseDesc: 'Sortera automatiskt dina gillade Spotify-låtar i genrebaserade spellistor med ett klick.',
        signInGithub: 'Logga in med GitHub',
        connectSpotify: 'Anslut Din Spotify',
        connectDesc: 'Anslut ditt Spotify-konto för att analysera dina gillade låtar och organisera dem efter genre.',
        connectBtn: 'Anslut Spotify',
        fetchingGenres: 'Hämtar dina gillade låtar och genrer...',
        likedSongs: 'Gillade Låtar',
        genresFound: 'Genrer Hittade',
        selected: 'Valda',
        yourGenres: 'Dina Genrer',
        searchGenres: 'Sök genrer...',
        selectAll: 'Välj Alla',
        selectNone: 'Välj Ingen',
        createPlaylists: 'Skapa Spellistor',
        create: 'Skapa',
        creating: 'Skapar...',
        created: 'Skapad!',
        failed: 'Misslyckades',
        results: 'Resultat',
        successCreated: 'Lyckades skapa',
        of: 'av',
        playlists: 'spellistor',
        openSpotify: 'Öppna i Spotify',
        logout: 'Logga ut',
        errorLoad: 'Kunde inte ladda dina genrer. Försök att uppdatera sidan.',
        refresh: 'Uppdatera',
        tracks: 'låtar',
        errorGithubDenied: 'GitHub-auktorisering nekades.',
        errorNotAllowed: 'Ditt GitHub-konto är inte behörigt att använda denna app.',
        errorAuthFailed: 'Autentisering misslyckades. Försök igen.',
        errorInvalidState: 'Ogiltigt tillstånd. Försök igen.',
        hallOfFame: 'Första Användarna',
        musicLoversJoined: 'musikälskare har gått med',
        signInSpotify: 'Logga in med Spotify',
      }
    };

    function t(key) {
      const lang = swedishMode ? 'sv' : 'en';
      return i18n[lang][key] || i18n.en[key] || key;
    }

    function toggleSwedishMode() {
      swedishMode = !swedishMode;
      localStorage.setItem('swedishMode', swedishMode);
      document.body.classList.toggle('swedish-mode', swedishMode);

      // Update all translatable elements
      document.querySelectorAll('[data-i18n]').forEach(el => {
        el.textContent = t(el.dataset.i18n);
      });

      // Update donation button (durry -> snus)
      const donationBtn = document.getElementById('donation-btn');
      if (donationBtn) {
        const icon = donationBtn.querySelector('.icon');
        const text = donationBtn.querySelector('.text');
        if (swedishMode) {
          icon.textContent = '🫙';
          text.textContent = 'Bjud mig på snus';
          donationBtn.title = 'Tack för stödet, kompis!';
        } else {
          icon.textContent = '🚬';
          text.textContent = 'Shout me a durry';
          donationBtn.title = 'Chuck us a dart, legend';
        }
      }

      // Play Swedish chime when entering Swedish mode
      if (swedishMode) {
        try {
          const audio = new Audio(swedishChime);
          audio.volume = 0.3;
          audio.play().catch(() => {}); // Ignore autoplay restrictions
        } catch {}
        showNotification('🇸🇪 Välkommen till svenskt läge! Tack Heidi! 👑', 'success');
      } else {
        showNotification('Back to normal mode!', 'success');
      }

      // Re-render current view to update all text
      if (genreData) {
        renderGenres();
      }
    }

    // Apply Swedish mode on load if previously enabled
    if (swedishMode) {
      document.body.classList.add('swedish-mode');
      // Also update the donation button on load
      const donationBtn = document.getElementById('donation-btn');
      if (donationBtn) {
        const icon = donationBtn.querySelector('.icon');
        const text = donationBtn.querySelector('.text');
        if (icon) icon.textContent = '🫙';
        if (text) text.textContent = 'Bjud mig på snus';
        donationBtn.title = 'Tack för stödet, kompis!';
      }
    }

    async function init() {
      // Check for errors in URL
      const params = new URLSearchParams(window.location.search);
      const error = params.get('error');

      // Load stats for user counter
      try {
        statsData = await fetch('/stats').then(r => r.json());
      } catch {}

      // Check session
      const session = await fetch('/session').then(r => r.json());
      spotifyOnlyMode = session.spotifyOnly || false;

      if (!session.authenticated) {
        renderWelcome(error);
        return;
      }

      renderHeaderUser(session);

      // In Spotify-only mode, we're already connected if authenticated
      if (!spotifyOnlyMode && !session.spotifyConnected) {
        renderConnectSpotify();
        return;
      }

      renderLoading(t('fetchingGenres'));
      await loadGenres();
    }

    function renderWelcome(error) {
      const errorMessages = {
        'github_denied': t('errorGithubDenied'),
        'not_allowed': t('errorNotAllowed'),
        'auth_failed': t('errorAuthFailed'),
        'invalid_state': t('errorInvalidState'),
        'spotify_denied': 'Spotify authorisation was denied.',
        'spotify_auth_failed': 'Spotify authentication failed. Please try again.',
      };

      // User counter HTML - now with Swedish translation
      const userCounterHtml = statsData?.userCount ? \`
        <div class="user-counter">
          <span>\${swedishMode ? '🇸🇪' : '🎵'}</span>
          <span><span class="count">\${statsData.userCount}</span> \${t('musicLoversJoined')}</span>
        </div>
      \` : '';

      // Hall of fame HTML - using i18n
      const hofHtml = statsData?.hallOfFame?.length ? \`
        <div class="hall-of-fame">
          <h3>🏆 \${t('hallOfFame')}</h3>
          <div class="hof-list">
            \${statsData.hallOfFame.map(u => \`
              <div class="hof-entry">
                <span class="position">#\${u.position}</span>
                <span>\${u.spotifyName}</span>
              </div>
            \`).join('')}
          </div>
        </div>
      \` : '';

      // Different login button based on mode
      const loginButton = spotifyOnlyMode ? \`
        <a href="/auth/spotify" class="btn btn-primary">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm4.586 14.424a.622.622 0 01-.857.207c-2.348-1.435-5.304-1.76-8.785-.964a.622.622 0 01-.277-1.215c3.809-.87 7.076-.496 9.712 1.115.293.18.386.563.207.857zm1.223-2.722a.78.78 0 01-1.072.257c-2.687-1.652-6.785-2.131-9.965-1.166a.78.78 0 01-.973-.519.781.781 0 01.52-.972c3.632-1.102 8.147-.568 11.233 1.329a.78.78 0 01.257 1.071zm.105-2.835c-3.223-1.914-8.54-2.09-11.618-1.156a.935.935 0 11-.543-1.79c3.533-1.072 9.404-.865 13.115 1.338a.935.935 0 11-.954 1.608z"/>
          </svg>
          <span>\${t('signInSpotify')}</span>
        </a>
      \` : \`
        <a href="/auth/github" class="btn btn-primary">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/>
          </svg>
          <span data-i18n="signInGithub">\${t('signInGithub')}</span>
        </a>
      \`;

      app.innerHTML = \`
        <div class="welcome">
          \${error ? \`<div class="error">\${errorMessages[error] || error}</div>\` : ''}
          \${userCounterHtml}
          <h2 data-i18n="organiseMusic">\${t('organiseMusic')}</h2>
          <p data-i18n="organiseDesc">\${t('organiseDesc')}</p>
          \${loginButton}
          <div class="footer-badges">
            <a href="https://github.com/TomsTech/spotify-genre-sorter" target="_blank">
              <img src="https://img.shields.io/github/stars/TomsTech/spotify-genre-sorter?style=for-the-badge&logo=github&logoColor=white&label=Star&color=1DB954&labelColor=191414" alt="Star on GitHub">
            </a>
            <a href="https://stats.uptimerobot.com/tomstech" target="_blank">
              <img src="https://img.shields.io/badge/uptime-100%25-1DB954?style=for-the-badge&logo=checkmarx&logoColor=white&labelColor=191414" alt="Uptime">
            </a>
          </div>
          \${hofHtml}
        </div>
      \`;
    }

    function renderHeaderUser(session) {
      const avatar = session.avatar || session.spotifyAvatar || session.githubAvatar;
      const user = session.user || session.spotifyUser || session.githubUser;
      headerActions.innerHTML = \`
        <div class="user-info">
          \${avatar ? \`<img src="\${avatar}" alt="" class="avatar">\` : ''}
          <span>\${user || 'User'}</span>
          <a href="/auth/logout" class="btn btn-ghost" data-i18n="logout">\${t('logout')}</a>
        </div>
      \`;
    }

    function renderConnectSpotify() {
      app.innerHTML = \`
        <div class="card">
          <h2 class="card-title" data-i18n="connectSpotify">\${t('connectSpotify')}</h2>
          <p style="color: var(--text-muted); margin-bottom: 1.5rem;" data-i18n="connectDesc">
            \${t('connectDesc')}
          </p>
          <a href="/auth/spotify" class="btn btn-primary">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm4.586 14.424a.622.622 0 01-.857.207c-2.348-1.435-5.304-1.76-8.785-.964a.622.622 0 01-.277-1.215c3.809-.87 7.076-.496 9.712 1.115.293.18.386.563.207.857zm1.223-2.722a.78.78 0 01-1.072.257c-2.687-1.652-6.785-2.131-9.965-1.166a.78.78 0 01-.973-.519.781.781 0 01.52-.972c3.632-1.102 8.147-.568 11.233 1.329a.78.78 0 01.257 1.071zm.105-2.835c-3.223-1.914-8.54-2.09-11.618-1.156a.935.935 0 11-.543-1.79c3.533-1.072 9.404-.865 13.115 1.338a.935.935 0 11-.954 1.608z"/>
            </svg>
            <span data-i18n="connectBtn">\${t('connectBtn')}</span>
          </a>
        </div>
      \`;
    }

    function renderLoading(message, subMessage = '') {
      app.innerHTML = \`
        <div class="loading">
          <div class="spinner"></div>
          <span>\${message}</span>
          \${subMessage ? \`<span class="loading-sub">\${subMessage}</span>\` : ''}
        </div>
      \`;
    }

    async function loadGenres() {
      try {
        renderLoading(
          swedishMode ? 'Hämtar dina låtar...' : 'Fetching your liked songs...',
          swedishMode ? 'Detta kan ta en stund för stora bibliotek' : 'This may take a moment for large libraries'
        );

        const response = await fetch('/api/genres');
        const data = await response.json();

        if (!response.ok) {
          // Show detailed error from API
          const errorDetail = data.details || data.error || 'Unknown error';
          const step = data.step || 'unknown';
          const stepLabels = {
            'fetching_tracks': 'while fetching your liked tracks',
            'fetching_artists': 'while fetching artist data',
            'unknown': ''
          };

          app.innerHTML = \`
            <div class="error">
              <strong>Error \${stepLabels[step] || ''}</strong>
              <p>\${errorDetail}</p>
              \${data.tracksFound ? \`<p class="error-detail">Tracks found: \${data.tracksFound}</p>\` : ''}
              \${data.artistsToFetch ? \`<p class="error-detail">Artists to fetch: \${data.artistsToFetch}</p>\` : ''}
            </div>
            <button onclick="loadGenres()" class="btn btn-secondary">Try Again</button>
            <button onclick="location.href='/auth/logout'" class="btn btn-secondary">Reconnect Spotify</button>
          \`;
          return;
        }

        if (data.totalTracks === 0) {
          app.innerHTML = \`
            <div class="card">
              <h2>No Liked Songs Found</h2>
              <p>Your Spotify library doesn't have any liked songs yet. Like some songs on Spotify and come back!</p>
            </div>
          \`;
          return;
        }

        genreData = data;
        renderGenres();
      } catch (error) {
        console.error('Load genres error:', error);
        app.innerHTML = \`
          <div class="error">
            <strong>Connection Error</strong>
            <p>Could not connect to the server. Please check your internet connection.</p>
            <p class="error-detail">\${error.message || 'Unknown error'}</p>
          </div>
          <button onclick="loadGenres()" class="btn btn-secondary">Try Again</button>
        \`;
      }
    }

    function renderGenres() {
      const filteredGenres = filterGenres('');

      app.innerHTML = \`
        <div class="stats">
          <div class="stat">
            <div class="stat-value">\${genreData.totalTracks.toLocaleString()}</div>
            <div class="stat-label" data-i18n="likedSongs">\${t('likedSongs')}</div>
          </div>
          <div class="stat">
            <div class="stat-value">\${genreData.totalGenres.toLocaleString()}</div>
            <div class="stat-label" data-i18n="genresFound">\${t('genresFound')}</div>
          </div>
          <div class="stat">
            <div class="stat-value" id="selected-count">0</div>
            <div class="stat-label" data-i18n="selected">\${t('selected')}</div>
          </div>
        </div>

        <div class="card">
          <h2 class="card-title" data-i18n="yourGenres">\${t('yourGenres')}</h2>
          <input
            type="text"
            class="search-input"
            placeholder="\${t('searchGenres')}"
            data-i18n-placeholder="searchGenres"
            oninput="filterAndRenderGenres(this.value)"
          >
          <div class="genre-list" id="genre-list"></div>
          <div class="actions">
            <button onclick="selectAll()" class="btn btn-secondary" data-i18n="selectAll">\${t('selectAll')}</button>
            <button onclick="selectNone()" class="btn btn-secondary" data-i18n="selectNone">\${t('selectNone')}</button>
            <button onclick="createSelectedPlaylists()" class="btn btn-primary" id="create-btn" disabled data-i18n="createPlaylists">
              \${t('createPlaylists')}
            </button>
          </div>
        </div>

        <div id="results"></div>
      \`;

      renderGenreList(filteredGenres);
    }

    function filterGenres(query) {
      if (!query) return genreData.genres;
      const lower = query.toLowerCase();
      return genreData.genres.filter(g => g.name.toLowerCase().includes(lower));
    }

    function filterAndRenderGenres(query) {
      const filtered = filterGenres(query);
      renderGenreList(filtered);
    }

    function renderGenreList(genres) {
      const list = document.getElementById('genre-list');
      list.innerHTML = genres.map(genre => \`
        <label class="genre-item">
          <input
            type="checkbox"
            class="genre-checkbox"
            value="\${genre.name}"
            \${selectedGenres.has(genre.name) ? 'checked' : ''}
            onchange="toggleGenre('\${genre.name.replace(/'/g, "\\\\'")}', this.checked)"
          >
          <span class="genre-name">\${genre.name}</span>
          <span class="genre-count">\${genre.count} \${t('tracks')}</span>
          <button
            class="btn btn-ghost genre-create"
            onclick="event.preventDefault(); createPlaylist('\${genre.name.replace(/'/g, "\\\\'")}')"
            data-i18n="create"
          >
            \${t('create')}
          </button>
        </label>
      \`).join('');
    }

    function toggleGenre(name, checked) {
      if (checked) {
        selectedGenres.add(name);
      } else {
        selectedGenres.delete(name);
      }
      updateSelectedCount();
    }

    function updateSelectedCount() {
      document.getElementById('selected-count').textContent = selectedGenres.size;
      document.getElementById('create-btn').disabled = selectedGenres.size === 0;
    }

    function selectAll() {
      const checkboxes = document.querySelectorAll('.genre-checkbox');
      checkboxes.forEach(cb => {
        cb.checked = true;
        selectedGenres.add(cb.value);
      });
      updateSelectedCount();
    }

    function selectNone() {
      selectedGenres.clear();
      const checkboxes = document.querySelectorAll('.genre-checkbox');
      checkboxes.forEach(cb => cb.checked = false);
      updateSelectedCount();
    }

    async function createPlaylist(genreName) {
      const genre = genreData.genres.find(g => g.name === genreName);
      if (!genre) return;

      const btn = event.target;
      btn.disabled = true;
      btn.textContent = t('creating');

      try {
        const response = await fetch('/api/playlist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ genre: genre.name, trackIds: genre.trackIds }),
        });

        const result = await response.json();

        if (result.success) {
          btn.textContent = t('created');
          btn.style.color = 'var(--accent)';
          showNotification(\`\${swedishMode ? 'Skapade spellista' : 'Created playlist'}: \${genre.name} (\${genre.count} \${t('tracks')})\`, 'success');
        } else {
          throw new Error(result.error);
        }
      } catch (error) {
        btn.textContent = t('failed');
        btn.style.color = 'var(--danger)';
        showNotification(\`\${t('failed')}: \${error.message}\`, 'error');
      }

      setTimeout(() => {
        btn.disabled = false;
        btn.textContent = t('create');
        btn.style.color = '';
      }, 3000);
    }

    async function createSelectedPlaylists() {
      if (selectedGenres.size === 0) return;

      const btn = document.getElementById('create-btn');
      btn.disabled = true;
      btn.textContent = \`\${t('creating').replace('...', '')} \${selectedGenres.size} \${t('playlists')}...\`;

      const genres = genreData.genres
        .filter(g => selectedGenres.has(g.name))
        .map(g => ({ name: g.name, trackIds: g.trackIds }));

      try {
        const response = await fetch('/api/playlists/bulk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ genres }),
        });

        const result = await response.json();

        document.getElementById('results').innerHTML = \`
          <div class="card">
            <h2 class="card-title" data-i18n="results">\${t('results')}</h2>
            <p style="margin-bottom: 1rem;">
              \${t('successCreated')} \${result.successful} \${t('of')} \${result.total} \${t('playlists')}.
            </p>
            <div class="results">
              \${result.results.map(r => \`
                <div class="result-item">
                  <span>\${r.genre}</span>
                  \${r.success
                    ? \`<a href="\${r.url}" target="_blank" class="result-success" data-i18n="openSpotify">\${t('openSpotify')}</a>\`
                    : \`<span class="result-error">\${r.error}</span>\`
                  }
                </div>
              \`).join('')}
            </div>
          </div>
        \`;

        selectedGenres.clear();
        updateSelectedCount();
        renderGenreList(filterGenres(''));
      } catch (error) {
        showNotification(\`\${t('failed')}: \${error.message}\`, 'error');
      }

      btn.disabled = false;
      btn.textContent = t('createPlaylists');
    }

    function showNotification(message, type) {
      const existing = document.querySelector('.notification');
      if (existing) existing.remove();

      const div = document.createElement('div');
      div.className = \`notification \${type}\`;
      div.style.cssText = \`
        position: fixed;
        bottom: 4rem;
        right: 2rem;
        padding: 1rem 1.5rem;
        border-radius: 8px;
        background: \${type === 'success' ? 'var(--accent)' : 'var(--danger)'};
        color: \${type === 'success' ? '#000' : '#fff'};
        font-weight: 500;
        z-index: 1000;
        animation: slideIn 0.3s ease;
        max-width: 300px;
      \`;
      div.textContent = message;
      document.body.appendChild(div);

      setTimeout(() => div.remove(), 5000);
    }

    // Initialize
    init();
  </script>
</body>
</html>`;
}

export default app;
```

src\lib\github.ts
```ts
export interface GitHubUser {
  login: string;
  avatar_url: string;
  name: string | null;
}

export function getGitHubAuthUrl(clientId: string, redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: 'read:user',
    state,
  });
  return `https://github.com/login/oauth/authorize?${params.toString()}`;
}

export async function exchangeGitHubCode(
  code: string,
  clientId: string,
  clientSecret: string
): Promise<string> {
  const response = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
    }),
  });

  const data: { access_token?: string; error?: string } = await response.json();
  if (data.error || !data.access_token) {
    throw new Error(data.error || 'Failed to exchange code');
  }
  return data.access_token;
}

export async function getGitHubUser(accessToken: string): Promise<GitHubUser> {
  const response = await fetch('https://api.github.com/user', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'Spotify-Genre-Organizer',
    },
  });

  if (!response.ok) {
    throw new Error('Failed to get GitHub user');
  }

  const data: GitHubUser = await response.json();
  return data;
}

export function isUserAllowed(username: string, allowedUsers: string): boolean {
  if (!allowedUsers || allowedUsers.trim() === '') {
    // If no allowed users configured, allow all
    return true;
  }
  const allowed = allowedUsers.split(',').map(u => u.trim().toLowerCase());
  return allowed.includes(username.toLowerCase());
}
```

src\lib\session.ts
```ts
import { Context } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';

export interface Session {
  githubUser?: string;
  githubAvatar?: string;
  spotifyUser?: string;
  spotifyUserId?: string;
  spotifyAvatar?: string;
  spotifyAccessToken?: string;
  spotifyRefreshToken?: string;
  spotifyExpiresAt?: number;
}

const SESSION_COOKIE = 'session_id';
const SESSION_TTL = 60 * 60 * 24 * 7; // 7 days

export async function createSession(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  c: Context<{ Bindings: Env }, any, any>,
  session: Session
): Promise<string> {
  const sessionId = crypto.randomUUID();
  await c.env.SESSIONS.put(
    `session:${sessionId}`,
    JSON.stringify(session),
    { expirationTtl: SESSION_TTL }
  );

  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  setCookie(c, SESSION_COOKIE, sessionId, {
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
    maxAge: SESSION_TTL,
    path: '/',
  });

  return sessionId;
}

export async function getSession(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  c: Context<{ Bindings: Env }, any, any>
): Promise<Session | null> {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  const sessionId = getCookie(c, SESSION_COOKIE);
  if (!sessionId) return null;

  const data = await c.env.SESSIONS.get(`session:${sessionId}`);
  if (!data) return null;

  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const session: Session = JSON.parse(data);
  return session;
}

export async function updateSession(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  c: Context<{ Bindings: Env }, any, any>,
  updates: Partial<Session>
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  const sessionId = getCookie(c, SESSION_COOKIE);
  if (!sessionId) return;

  const existing = await getSession(c);
  if (!existing) return;

  const updated = { ...existing, ...updates };
  await c.env.SESSIONS.put(
    `session:${sessionId}`,
    JSON.stringify(updated),
    { expirationTtl: SESSION_TTL }
  );
}

export async function deleteSession(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  c: Context<{ Bindings: Env }, any, any>
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  const sessionId = getCookie(c, SESSION_COOKIE);
  if (sessionId) {
    await c.env.SESSIONS.delete(`session:${sessionId}`);
  }
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  deleteCookie(c, SESSION_COOKIE, { path: '/' });
}

export function generateState(): string {
  return crypto.randomUUID();
}

export async function storeState(
  kv: KVNamespace,
  state: string,
  data: Record<string, string>
): Promise<void> {
  await kv.put(`state:${state}`, JSON.stringify(data), { expirationTtl: 600 });
}

export async function verifyState(
  kv: KVNamespace,
  state: string
): Promise<Record<string, string> | null> {
  const data = await kv.get(`state:${state}`);
  if (!data) return null;
  await kv.delete(`state:${state}`);
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const parsed: Record<string, string> = JSON.parse(data);
  return parsed;
}
```

src\lib\spotify.ts
```ts
export interface SpotifyTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

export interface SpotifyTrack {
  id: string;
  name: string;
  artists: { id: string; name: string }[];
  album: { name: string; images: { url: string }[] };
}

export interface SpotifyArtist {
  id: string;
  name: string;
  genres: string[];
}

export interface LikedTrack {
  track: SpotifyTrack;
  added_at: string;
}

const SPOTIFY_API = 'https://api.spotify.com/v1';
const SPOTIFY_AUTH = 'https://accounts.spotify.com';

// High availability: retry with exponential backoff
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchWithRetry(
  url: string,
  options: RequestInit,
  retries = MAX_RETRIES
): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await fetch(url, options);

      // Retry on rate limiting (429) or server errors (5xx)
      if (response.status === 429 || response.status >= 500) {
        const retryAfter = response.headers.get('Retry-After');
        const delay = retryAfter
          ? parseInt(retryAfter, 10) * 1000
          : BASE_DELAY_MS * Math.pow(2, attempt);

        if (attempt < retries - 1) {
          await sleep(delay);
          continue;
        }
      }

      return response;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));

      if (attempt < retries - 1) {
        await sleep(BASE_DELAY_MS * Math.pow(2, attempt));
        continue;
      }
    }
  }

  throw lastError || new Error('Request failed after retries');
}

export function getSpotifyAuthUrl(
  clientId: string,
  redirectUri: string,
  state: string
): string {
  const scopes = [
    'user-library-read',
    'playlist-modify-public',
    'playlist-modify-private',
    'user-read-private',
  ].join(' ');

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: redirectUri,
    scope: scopes,
    state,
  });

  return `${SPOTIFY_AUTH}/authorize?${params.toString()}`;
}

export async function exchangeSpotifyCode(
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string
): Promise<SpotifyTokens> {
  const response = await fetchWithRetry(`${SPOTIFY_AUTH}/api/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Spotify token exchange failed: ${error}`);
  }

  const data: SpotifyTokens = await response.json();
  return data;
}

export async function refreshSpotifyToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string
): Promise<SpotifyTokens> {
  const response = await fetchWithRetry(`${SPOTIFY_AUTH}/api/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to refresh Spotify token');
  }

  const data: SpotifyTokens = await response.json();
  // Spotify may not return a new refresh token
  return {
    ...data,
    refresh_token: data.refresh_token || refreshToken,
  };
}

async function spotifyFetch<T>(
  endpoint: string,
  accessToken: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetchWithRetry(`${SPOTIFY_API}${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Spotify API error: ${response.status} ${error}`);
  }

  const data: T = await response.json();
  return data;
}

export async function getLikedTracks(
  accessToken: string,
  limit = 50,
  offset = 0
): Promise<{ items: LikedTrack[]; total: number; next: string | null }> {
  return spotifyFetch(
    `/me/tracks?limit=${limit}&offset=${offset}`,
    accessToken
  );
}

export async function getAllLikedTracks(
  accessToken: string,
  onProgress?: (loaded: number, total: number) => void
): Promise<LikedTrack[]> {
  const allTracks: LikedTrack[] = [];
  let offset = 0;
  const limit = 50;
  let total = 0;

  do {
    const response = await getLikedTracks(accessToken, limit, offset);
    allTracks.push(...response.items);
    total = response.total;
    offset += limit;
    onProgress?.(allTracks.length, total);
  } while (offset < total);

  return allTracks;
}

export async function getArtists(
  accessToken: string,
  artistIds: string[]
): Promise<SpotifyArtist[]> {
  // Spotify API allows max 50 artists per request
  const chunks: string[][] = [];
  for (let i = 0; i < artistIds.length; i += 50) {
    chunks.push(artistIds.slice(i, i + 50));
  }

  const results: SpotifyArtist[] = [];
  for (const chunk of chunks) {
    const response = await spotifyFetch<{ artists: (SpotifyArtist | null)[] }>(
      `/artists?ids=${chunk.join(',')}`,
      accessToken
    );
    // Filter out null entries (some artists may not have data)
    const validArtists = response.artists.filter((a): a is SpotifyArtist => a !== null);
    results.push(...validArtists);
  }

  return results;
}

export async function getTracksWithGenres(
  accessToken: string
): Promise<Map<string, { track: SpotifyTrack; genres: string[]; addedAt: string }>> {
  const likedTracks = await getAllLikedTracks(accessToken);

  // Collect unique artist IDs
  const artistIds = new Set<string>();
  for (const { track } of likedTracks) {
    for (const artist of track.artists) {
      artistIds.add(artist.id);
    }
  }

  // Fetch all artists to get genres
  const artists = await getArtists(accessToken, [...artistIds]);
  const artistGenreMap = new Map<string, string[]>();
  for (const artist of artists) {
    artistGenreMap.set(artist.id, artist.genres);
  }

  // Map tracks to their genres
  const tracksWithGenres = new Map<string, { track: SpotifyTrack; genres: string[]; addedAt: string }>();
  for (const { track, added_at } of likedTracks) {
    const genres = new Set<string>();
    for (const artist of track.artists) {
      const artistGenres = artistGenreMap.get(artist.id) || [];
      artistGenres.forEach(g => genres.add(g));
    }
    tracksWithGenres.set(track.id, { track, genres: [...genres], addedAt: added_at });
  }

  return tracksWithGenres;
}

export async function createPlaylist(
  accessToken: string,
  userId: string,
  name: string,
  description: string,
  isPublic = false
): Promise<{ id: string; external_urls: { spotify: string } }> {
  return spotifyFetch(`/users/${userId}/playlists`, accessToken, {
    method: 'POST',
    body: JSON.stringify({
      name,
      description,
      public: isPublic,
    }),
  });
}

export async function addTracksToPlaylist(
  accessToken: string,
  playlistId: string,
  trackUris: string[]
): Promise<void> {
  // Spotify allows max 100 tracks per request
  for (let i = 0; i < trackUris.length; i += 100) {
    const chunk = trackUris.slice(i, i + 100);
    await spotifyFetch(`/playlists/${playlistId}/tracks`, accessToken, {
      method: 'POST',
      body: JSON.stringify({ uris: chunk }),
    });
  }
}

export async function getCurrentUser(
  accessToken: string
): Promise<{ id: string; display_name: string; images: { url: string }[] }> {
  return spotifyFetch('/me', accessToken);
}
```

src\routes\api.ts
```ts
import { Hono } from 'hono';
import { getSession, updateSession } from '../lib/session';
import {
  refreshSpotifyToken,
  getAllLikedTracks,
  getArtists,
  createPlaylist,
  addTracksToPlaylist,
  getCurrentUser,
} from '../lib/spotify';

const api = new Hono<{ Bindings: Env }>();

// Security constants
const MAX_TRACK_IDS = 10000; // Max tracks per playlist
const MAX_GENRES_BULK = 50; // Max genres in bulk create
const MAX_GENRE_NAME_LENGTH = 100;
const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 30; // 30 requests per minute
const SPOTIFY_TRACK_ID_REGEX = /^[a-zA-Z0-9]{22}$/;

// Simple in-memory rate limiter (resets on worker restart, but good enough for abuse prevention)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

// Rate limiting middleware
api.use('/*', async (c, next) => {
  const clientIP = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || 'unknown';
  const now = Date.now();

  const rateData = rateLimitMap.get(clientIP);
  if (rateData) {
    if (now > rateData.resetAt) {
      // Window expired, reset
      rateLimitMap.set(clientIP, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    } else if (rateData.count >= RATE_LIMIT_MAX_REQUESTS) {
      c.header('Retry-After', String(Math.ceil((rateData.resetAt - now) / 1000)));
      return c.json({ error: 'Rate limit exceeded. Please try again later.' }, 429);
    } else {
      rateData.count++;
    }
  } else {
    rateLimitMap.set(clientIP, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
  }

  // Clean up old entries periodically (every 100 requests)
  if (Math.random() < 0.01) {
    for (const [ip, data] of rateLimitMap.entries()) {
      if (now > data.resetAt + RATE_LIMIT_WINDOW_MS) {
        rateLimitMap.delete(ip);
      }
    }
  }

  await next();
});

// Auth middleware - check auth and refresh tokens if needed
api.use('/*', async (c, next) => {
  const session = await getSession(c);

  if (!session) {
    return c.json({ error: 'Not authenticated' }, 401);
  }

  if (!session.spotifyAccessToken) {
    return c.json({ error: 'Spotify not connected' }, 401);
  }

  // Check if token is expired or about to expire (5 min buffer)
  if (session.spotifyExpiresAt && session.spotifyExpiresAt < Date.now() + 300000) {
    if (!session.spotifyRefreshToken) {
      return c.json({ error: 'Spotify session expired' }, 401);
    }

    try {
      const tokens = await refreshSpotifyToken(
        session.spotifyRefreshToken,
        c.env.SPOTIFY_CLIENT_ID,
        c.env.SPOTIFY_CLIENT_SECRET
      );

      await updateSession(c, {
        spotifyAccessToken: tokens.access_token,
        spotifyRefreshToken: tokens.refresh_token,
        spotifyExpiresAt: Date.now() + tokens.expires_in * 1000,
      });

      session.spotifyAccessToken = tokens.access_token;
    } catch (err) {
      console.error('Token refresh failed:', err);
      return c.json({ error: 'Failed to refresh Spotify token' }, 401);
    }
  }

  c.set('session' as never, session);
  await next();
});

// Get current user info
api.get('/me', async (c) => {
  const session = await getSession(c);
  if (!session?.spotifyAccessToken) {
    return c.json({ error: 'Not authenticated' }, 401);
  }

  try {
    const spotifyUser = await getCurrentUser(session.spotifyAccessToken);
    return c.json({
      github: {
        username: session.githubUser,
        avatar: session.githubAvatar,
      },
      spotify: {
        id: spotifyUser.id,
        name: spotifyUser.display_name,
        avatar: spotifyUser.images?.[0]?.url,
      },
    });
  } catch (err) {
    console.error('Error fetching user:', err);
    return c.json({ error: 'Failed to fetch user info' }, 500);
  }
});

// Get all genres from liked tracks
api.get('/genres', async (c) => {
  const session = await getSession(c);
  if (!session?.spotifyAccessToken) {
    return c.json({ error: 'Not authenticated', details: 'No Spotify access token found. Please reconnect Spotify.' }, 401);
  }

  try {
    // Step 1: Get all liked tracks
    let likedTracks;
    try {
      likedTracks = await getAllLikedTracks(session.spotifyAccessToken);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error('Error fetching liked tracks:', message);
      return c.json({
        error: 'Failed to fetch liked tracks from Spotify',
        details: message,
        step: 'fetching_tracks'
      }, 500);
    }

    if (!likedTracks || likedTracks.length === 0) {
      return c.json({
        totalTracks: 0,
        totalGenres: 0,
        genres: [],
        message: 'No liked tracks found in your Spotify library'
      });
    }

    // Step 2: Collect unique artist IDs
    const artistIds = new Set<string>();
    for (const { track } of likedTracks) {
      for (const artist of track.artists) {
        artistIds.add(artist.id);
      }
    }

    // Step 3: Fetch all artists to get genres
    let artists;
    try {
      artists = await getArtists(session.spotifyAccessToken, [...artistIds]);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error('Error fetching artists:', message);
      return c.json({
        error: 'Failed to fetch artist data from Spotify',
        details: message,
        step: 'fetching_artists',
        tracksFound: likedTracks.length,
        artistsToFetch: artistIds.size
      }, 500);
    }

    const artistGenreMap = new Map<string, string[]>();
    for (const artist of artists) {
      artistGenreMap.set(artist.id, artist.genres);
    }

    // Step 4: Count tracks per genre and collect track IDs
    const genreData = new Map<string, { count: number; trackIds: string[] }>();

    for (const { track } of likedTracks) {
      const trackGenres = new Set<string>();
      for (const artist of track.artists) {
        const genres = artistGenreMap.get(artist.id) || [];
        genres.forEach(g => trackGenres.add(g));
      }

      for (const genre of trackGenres) {
        let data = genreData.get(genre);
        if (!data) {
          data = { count: 0, trackIds: [] };
          genreData.set(genre, data);
        }
        data.count++;
        data.trackIds.push(track.id);
      }
    }

    // Convert to sorted array
    const genres = [...genreData.entries()]
      .map(([name, data]) => ({
        name,
        count: data.count,
        trackIds: data.trackIds,
      }))
      .sort((a, b) => b.count - a.count);

    return c.json({
      totalTracks: likedTracks.length,
      totalGenres: genres.length,
      totalArtists: artistIds.size,
      genres,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('Error fetching genres:', err);
    return c.json({
      error: 'Failed to fetch genres',
      details: message,
      step: 'unknown'
    }, 500);
  }
});

// Helper to validate track IDs
function validateTrackIds(trackIds: unknown): { valid: boolean; error?: string; ids?: string[] } {
  if (!Array.isArray(trackIds)) {
    return { valid: false, error: 'trackIds must be an array' };
  }
  if (trackIds.length === 0) {
    return { valid: false, error: 'trackIds cannot be empty' };
  }
  if (trackIds.length > MAX_TRACK_IDS) {
    return { valid: false, error: `trackIds exceeds maximum of ${MAX_TRACK_IDS}` };
  }

  const validIds: string[] = [];
  for (const id of trackIds) {
    if (typeof id !== 'string' || !SPOTIFY_TRACK_ID_REGEX.test(id)) {
      return { valid: false, error: 'Invalid track ID format detected' };
    }
    validIds.push(id);
  }

  return { valid: true, ids: validIds };
}

// Helper to sanitise genre name
function sanitiseGenreName(genre: unknown): { valid: boolean; error?: string; name?: string } {
  if (typeof genre !== 'string') {
    return { valid: false, error: 'Genre must be a string' };
  }
  const trimmed = genre.trim();
  if (trimmed.length === 0) {
    return { valid: false, error: 'Genre cannot be empty' };
  }
  if (trimmed.length > MAX_GENRE_NAME_LENGTH) {
    return { valid: false, error: `Genre name exceeds ${MAX_GENRE_NAME_LENGTH} characters` };
  }
  // Remove any potentially dangerous characters (keep alphanumeric, spaces, hyphens, common chars)
  const sanitised = trimmed.replace(/[<>"'&]/g, '');
  return { valid: true, name: sanitised };
}

// Create a playlist for a specific genre
api.post('/playlist', async (c) => {
  const session = await getSession(c);
  if (!session?.spotifyAccessToken) {
    return c.json({ error: 'Not authenticated' }, 401);
  }

  try {
    const body = await c.req.json<{ genre: string; trackIds: string[] }>();
    const { genre, trackIds } = body;

    // Validate genre name
    const genreValidation = sanitiseGenreName(genre);
    if (!genreValidation.valid) {
      return c.json({ error: genreValidation.error }, 400);
    }

    // Validate track IDs
    const trackValidation = validateTrackIds(trackIds);
    if (!trackValidation.valid) {
      return c.json({ error: trackValidation.error }, 400);
    }

    const user = await getCurrentUser(session.spotifyAccessToken);
    const safeName = genreValidation.name!;
    const safeTrackIds = trackValidation.ids!;

    const playlist = await createPlaylist(
      session.spotifyAccessToken,
      user.id,
      `${safeName} (from Likes)`,
      `Auto-generated playlist of ${safeName} tracks from your liked songs`,
      false
    );

    const trackUris = safeTrackIds.map(id => `spotify:track:${id}`);
    await addTracksToPlaylist(session.spotifyAccessToken, playlist.id, trackUris);

    return c.json({
      success: true,
      playlist: {
        id: playlist.id,
        url: playlist.external_urls.spotify,
        name: `${safeName} (from Likes)`,
        trackCount: safeTrackIds.length,
      },
    });
  } catch (err) {
    console.error('Error creating playlist:', err);
    return c.json({ error: 'Failed to create playlist' }, 500);
  }
});

// Create playlists for multiple genres at once
api.post('/playlists/bulk', async (c) => {
  const session = await getSession(c);
  if (!session?.spotifyAccessToken) {
    return c.json({ error: 'Not authenticated' }, 401);
  }

  try {
    const body = await c.req.json<{ genres: { name: string; trackIds: string[] }[] }>();
    const { genres } = body;

    if (!Array.isArray(genres) || genres.length === 0) {
      return c.json({ error: 'Genres array required' }, 400);
    }

    if (genres.length > MAX_GENRES_BULK) {
      return c.json({ error: `Maximum ${MAX_GENRES_BULK} genres allowed per request` }, 400);
    }

    const user = await getCurrentUser(session.spotifyAccessToken);
    const results: { genre: string; success: boolean; url?: string; error?: string }[] = [];

    for (const { name, trackIds } of genres) {
      // Validate each genre
      const genreValidation = sanitiseGenreName(name);
      if (!genreValidation.valid) {
        results.push({ genre: String(name), success: false, error: genreValidation.error });
        continue;
      }

      const trackValidation = validateTrackIds(trackIds);
      if (!trackValidation.valid) {
        results.push({ genre: genreValidation.name!, success: false, error: trackValidation.error });
        continue;
      }

      try {
        const safeName = genreValidation.name!;
        const safeTrackIds = trackValidation.ids!;

        const playlist = await createPlaylist(
          session.spotifyAccessToken,
          user.id,
          `${safeName} (from Likes)`,
          `Auto-generated playlist of ${safeName} tracks from your liked songs`,
          false
        );

        const trackUris = safeTrackIds.map(id => `spotify:track:${id}`);
        await addTracksToPlaylist(session.spotifyAccessToken, playlist.id, trackUris);

        results.push({
          genre: safeName,
          success: true,
          url: playlist.external_urls.spotify,
        });
      } catch {
        // Don't expose internal error details
        results.push({
          genre: genreValidation.name!,
          success: false,
          error: 'Failed to create playlist',
        });
      }
    }

    return c.json({
      total: genres.length,
      successful: results.filter(r => r.success).length,
      results,
    });
  } catch (err) {
    console.error('Error creating playlists:', err);
    return c.json({ error: 'Failed to process request' }, 500);
  }
});

export default api;
```

src\routes\auth.ts
```ts
import { Hono } from 'hono';
import {
  getGitHubAuthUrl,
  exchangeGitHubCode,
  getGitHubUser,
  isUserAllowed,
} from '../lib/github';
import {
  getSpotifyAuthUrl,
  exchangeSpotifyCode,
  getCurrentUser,
} from '../lib/spotify';
import {
  createSession,
  getSession,
  updateSession,
  deleteSession,
  generateState,
  storeState,
  verifyState,
} from '../lib/session';

const auth = new Hono<{ Bindings: Env }>();

// Helper to check if running in Spotify-only mode
function isSpotifyOnlyMode(env: Env): boolean {
  return env.SPOTIFY_ONLY_AUTH === 'true' || !env.GITHUB_CLIENT_ID;
}

// Helper to register/update user in the hall of fame
async function registerUser(
  kv: KVNamespace,
  spotifyId: string,
  spotifyName: string,
  spotifyAvatar?: string,
  githubUser?: string
): Promise<void> {
  const key = `user:${spotifyId}`;
  const existing = await kv.get(key);
  const now = new Date().toISOString();

  if (existing) {
    // Update last seen
    const data = JSON.parse(existing) as {
      spotifyId: string;
      spotifyName: string;
      spotifyAvatar?: string;
      githubUser?: string;
      registeredAt: string;
      lastSeenAt: string;
    };
    data.lastSeenAt = now;
    data.spotifyName = spotifyName;
    if (spotifyAvatar) data.spotifyAvatar = spotifyAvatar;
    if (githubUser) data.githubUser = githubUser;
    await kv.put(key, JSON.stringify(data));
  } else {
    // New user registration
    const registration = {
      spotifyId,
      spotifyName,
      spotifyAvatar,
      githubUser,
      registeredAt: now,
      lastSeenAt: now,
    };
    await kv.put(key, JSON.stringify(registration));

    // Update user count
    const countStr = await kv.get('stats:user_count');
    const count = countStr ? parseInt(countStr, 10) : 0;
    await kv.put('stats:user_count', String(count + 1));

    // Add to hall of fame list (first 100 users)
    if (count < 100) {
      const hofKey = `hof:${String(count + 1).padStart(3, '0')}`;
      await kv.put(hofKey, JSON.stringify({
        position: count + 1,
        spotifyId,
        spotifyName,
        spotifyAvatar,
        registeredAt: now,
      }));
    }
  }
}

// GitHub OAuth - initiate
auth.get('/github', async (c) => {
  if (isSpotifyOnlyMode(c.env)) {
    return c.redirect('/auth/spotify');
  }

  const state = generateState();
  await storeState(c.env.SESSIONS, state, { provider: 'github' });

  const redirectUri = new URL('/auth/github/callback', c.req.url).toString();
  const url = getGitHubAuthUrl(c.env.GITHUB_CLIENT_ID!, redirectUri, state);

  return c.redirect(url);
});

// GitHub OAuth - callback
auth.get('/github/callback', async (c) => {
  if (isSpotifyOnlyMode(c.env)) {
    return c.redirect('/');
  }

  const code = c.req.query('code');
  const state = c.req.query('state');
  const error = c.req.query('error');

  if (error) {
    return c.redirect('/?error=github_denied');
  }

  if (!code || !state) {
    return c.redirect('/?error=invalid_request');
  }

  const stateData = await verifyState(c.env.SESSIONS, state);
  if (!stateData || stateData.provider !== 'github') {
    return c.redirect('/?error=invalid_state');
  }

  try {
    const accessToken = await exchangeGitHubCode(
      code,
      c.env.GITHUB_CLIENT_ID!,
      c.env.GITHUB_CLIENT_SECRET!
    );

    const user = await getGitHubUser(accessToken);

    if (!isUserAllowed(user.login, c.env.ALLOWED_GITHUB_USERS || '')) {
      return c.redirect('/?error=not_allowed');
    }

    await createSession(c, {
      githubUser: user.login,
      githubAvatar: user.avatar_url,
    });

    return c.redirect('/');
  } catch (err) {
    console.error('GitHub auth error:', err);
    return c.redirect('/?error=auth_failed');
  }
});

// Spotify OAuth - initiate (works for both modes)
auth.get('/spotify', async (c) => {
  const spotifyOnly = isSpotifyOnlyMode(c.env);

  // In GitHub mode, require session first
  if (!spotifyOnly) {
    const session = await getSession(c);
    if (!session) {
      return c.redirect('/?error=not_logged_in');
    }
  }

  const state = generateState();
  await storeState(c.env.SESSIONS, state, {
    provider: 'spotify',
    spotifyOnly: spotifyOnly ? 'true' : 'false',
  });

  const redirectUri = new URL('/auth/spotify/callback', c.req.url).toString();
  const url = getSpotifyAuthUrl(c.env.SPOTIFY_CLIENT_ID, redirectUri, state);

  return c.redirect(url);
});

// Spotify OAuth - callback
auth.get('/spotify/callback', async (c) => {
  const code = c.req.query('code');
  const state = c.req.query('state');
  const error = c.req.query('error');

  if (error) {
    return c.redirect('/?error=spotify_denied');
  }

  if (!code || !state) {
    return c.redirect('/?error=invalid_request');
  }

  const stateData = await verifyState(c.env.SESSIONS, state);
  if (!stateData || stateData.provider !== 'spotify') {
    return c.redirect('/?error=invalid_state');
  }

  const spotifyOnly = stateData.spotifyOnly === 'true';

  // In GitHub mode, require existing session
  const session = await getSession(c);
  if (!spotifyOnly && !session) {
    return c.redirect('/?error=not_logged_in');
  }

  try {
    const redirectUri = new URL('/auth/spotify/callback', c.req.url).toString();
    const tokens = await exchangeSpotifyCode(
      code,
      c.env.SPOTIFY_CLIENT_ID,
      c.env.SPOTIFY_CLIENT_SECRET,
      redirectUri
    );

    // Get Spotify user info
    const spotifyUser = await getCurrentUser(tokens.access_token);

    if (spotifyOnly) {
      // Create new session with Spotify as primary identity
      await createSession(c, {
        spotifyUser: spotifyUser.display_name,
        spotifyUserId: spotifyUser.id,
        spotifyAvatar: spotifyUser.images?.[0]?.url,
        spotifyAccessToken: tokens.access_token,
        spotifyRefreshToken: tokens.refresh_token,
        spotifyExpiresAt: Date.now() + tokens.expires_in * 1000,
      });
    } else {
      // Update existing session with Spotify tokens
      await updateSession(c, {
        spotifyUser: spotifyUser.display_name,
        spotifyUserId: spotifyUser.id,
        spotifyAvatar: spotifyUser.images?.[0]?.url,
        spotifyAccessToken: tokens.access_token,
        spotifyRefreshToken: tokens.refresh_token,
        spotifyExpiresAt: Date.now() + tokens.expires_in * 1000,
      });
    }

    // Register user in hall of fame
    await registerUser(
      c.env.SESSIONS,
      spotifyUser.id,
      spotifyUser.display_name,
      spotifyUser.images?.[0]?.url,
      session?.githubUser
    );

    return c.redirect('/');
  } catch (err) {
    console.error('Spotify auth error:', err);
    return c.redirect('/?error=spotify_auth_failed');
  }
});

// Logout
auth.get('/logout', async (c) => {
  await deleteSession(c);
  return c.redirect('/');
});

export default auth;
```

src\types.ts
```ts
// eslint-disable-next-line @typescript-eslint/no-unused-vars
interface Env {
  SESSIONS: KVNamespace;
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
  SPOTIFY_CLIENT_ID: string;
  SPOTIFY_CLIENT_SECRET: string;
  ALLOWED_GITHUB_USERS?: string;
  SPOTIFY_ONLY_AUTH?: string; // "true" to skip GitHub auth
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
interface UserRegistration {
  spotifyId: string;
  spotifyName: string;
  spotifyAvatar?: string;
  githubUser?: string;
  registeredAt: string;
  lastSeenAt: string;
}
```

tests\api.test.ts
```ts
import { describe, it, expect } from 'vitest';

describe('API Response Formats', () => {
  describe('GET /api/genres', () => {
    it('should return correct genre response structure', () => {
      const mockResponse = {
        totalTracks: 150,
        totalGenres: 25,
        genres: [
          { name: 'rock', count: 50, trackIds: ['t1', 't2'] },
          { name: 'pop', count: 30, trackIds: ['t3', 't4'] },
        ],
      };

      expect(mockResponse).toHaveProperty('totalTracks');
      expect(mockResponse).toHaveProperty('totalGenres');
      expect(mockResponse).toHaveProperty('genres');
      expect(Array.isArray(mockResponse.genres)).toBe(true);

      const genre = mockResponse.genres[0];
      expect(genre).toHaveProperty('name');
      expect(genre).toHaveProperty('count');
      expect(genre).toHaveProperty('trackIds');
    });
  });

  describe('POST /api/playlist', () => {
    it('should validate required fields', () => {
      const validBody = { genre: 'rock', trackIds: ['t1', 't2'] };
      const invalidBody1 = { trackIds: ['t1'] }; // missing genre
      const invalidBody2 = { genre: 'rock' }; // missing trackIds
      const invalidBody3 = { genre: 'rock', trackIds: [] }; // empty trackIds

      expect(validBody.genre).toBeTruthy();
      expect(validBody.trackIds?.length).toBeGreaterThan(0);

      expect(invalidBody1.genre).toBeUndefined();
      expect(invalidBody2.trackIds).toBeUndefined();
      expect(invalidBody3.trackIds?.length).toBe(0);
    });

    it('should return correct playlist response structure', () => {
      const mockResponse = {
        success: true,
        playlist: {
          id: 'playlist123',
          url: 'https://open.spotify.com/playlist/playlist123',
          name: 'rock (from Likes)',
          trackCount: 50,
        },
      };

      expect(mockResponse.success).toBe(true);
      expect(mockResponse.playlist).toHaveProperty('id');
      expect(mockResponse.playlist).toHaveProperty('url');
      expect(mockResponse.playlist.url).toContain('spotify.com');
    });
  });

  describe('POST /api/playlists/bulk', () => {
    it('should handle multiple genre requests', () => {
      const bulkRequest = {
        genres: [
          { name: 'rock', trackIds: ['t1', 't2'] },
          { name: 'pop', trackIds: ['t3', 't4'] },
          { name: 'jazz', trackIds: ['t5'] },
        ],
      };

      expect(bulkRequest.genres.length).toBe(3);

      for (const genre of bulkRequest.genres) {
        expect(genre.name).toBeTruthy();
        expect(genre.trackIds.length).toBeGreaterThan(0);
      }
    });

    it('should track success/failure for each genre', () => {
      const mockResults = {
        total: 3,
        successful: 2,
        results: [
          { genre: 'rock', success: true, url: 'https://...' },
          { genre: 'pop', success: true, url: 'https://...' },
          { genre: 'jazz', success: false, error: 'Rate limited' },
        ],
      };

      expect(mockResults.total).toBe(3);
      expect(mockResults.successful).toBe(2);
      expect(mockResults.results.filter(r => r.success).length).toBe(2);
      expect(mockResults.results.filter(r => !r.success).length).toBe(1);
    });
  });
});

describe('Authentication Middleware', () => {
  it('should return 401 for unauthenticated requests', () => {
    const session = null;
    const errorResponse = session ? null : { error: 'Not authenticated', status: 401 };

    expect(errorResponse).not.toBeNull();
    expect(errorResponse?.status).toBe(401);
  });

  it('should return 401 when Spotify not connected', () => {
    const session = { githubUser: 'user' }; // No spotify token
    const hasSpotify = !!session.spotifyAccessToken;

    expect(hasSpotify).toBe(false);
  });
});

describe('Error Responses', () => {
  const errorCases = [
    { status: 400, error: 'Genre and trackIds required' },
    { status: 401, error: 'Not authenticated' },
    { status: 401, error: 'Spotify not connected' },
    { status: 401, error: 'Spotify session expired' },
    { status: 500, error: 'Failed to fetch genres' },
    { status: 500, error: 'Failed to create playlist' },
  ];

  errorCases.forEach(({ status, error }) => {
    it(`should have ${status} status for "${error}"`, () => {
      expect(status).toBeGreaterThanOrEqual(400);
      expect(status).toBeLessThan(600);
      expect(error).toBeTruthy();
    });
  });
});

describe('Health & Setup Endpoints', () => {
  it('should return ok status for health check', () => {
    const healthResponse = { status: 'ok' };
    expect(healthResponse.status).toBe('ok');
  });

  it('should detect missing secrets in setup', () => {
    const env = {
      SPOTIFY_CLIENT_ID: 'set',
      SPOTIFY_CLIENT_SECRET: 'set',
      GITHUB_CLIENT_ID: undefined,
      GITHUB_CLIENT_SECRET: undefined,
    };

    const spotifyOnly = !env.GITHUB_CLIENT_ID;
    expect(spotifyOnly).toBe(true);
  });

  it('should report auth mode correctly', () => {
    const spotifyOnlyEnv = { SPOTIFY_ONLY_AUTH: 'true' };
    const githubEnv = { GITHUB_CLIENT_ID: 'set' };

    const isSpotifyOnly1 = spotifyOnlyEnv.SPOTIFY_ONLY_AUTH === 'true';
    const isSpotifyOnly2 = !githubEnv.GITHUB_CLIENT_ID;

    expect(isSpotifyOnly1).toBe(true);
    expect(isSpotifyOnly2).toBe(false);
  });
});
```

tests\session.test.ts
```ts
import { describe, it, expect } from 'vitest';
import { generateState } from '../src/lib/session';

describe('Session Management', () => {
  describe('generateState', () => {
    it('should generate a valid UUID', () => {
      const state = generateState();
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      expect(state).toMatch(uuidRegex);
    });

    it('should generate unique states on each call', () => {
      const states = new Set<string>();
      for (let i = 0; i < 100; i++) {
        states.add(generateState());
      }
      expect(states.size).toBe(100);
    });
  });

  describe('Session TTL', () => {
    it('should have a 7-day TTL constant', () => {
      const SESSION_TTL = 60 * 60 * 24 * 7;
      expect(SESSION_TTL).toBe(604800);
    });
  });

  describe('Cookie Configuration', () => {
    it('should use secure cookie settings', () => {
      const cookieOptions = {
        httpOnly: true,
        secure: true,
        sameSite: 'Lax' as const,
        path: '/',
      };

      expect(cookieOptions.httpOnly).toBe(true);
      expect(cookieOptions.secure).toBe(true);
      expect(cookieOptions.sameSite).toBe('Lax');
    });
  });
});

describe('Token Refresh Logic', () => {
  it('should trigger refresh when token expires within 5 minutes', () => {
    const expiresAt = Date.now() + (4 * 60 * 1000);
    const bufferMs = 5 * 60 * 1000;

    const needsRefresh = expiresAt < (Date.now() + bufferMs);
    expect(needsRefresh).toBe(true);
  });

  it('should not refresh when token is still valid', () => {
    const expiresAt = Date.now() + (30 * 60 * 1000);
    const bufferMs = 5 * 60 * 1000;

    const needsRefresh = expiresAt < (Date.now() + bufferMs);
    expect(needsRefresh).toBe(false);
  });
});
```

tests\spotify.test.ts
```ts
import { describe, it, expect } from 'vitest';
import { getSpotifyAuthUrl } from '../src/lib/spotify';

describe('Spotify Library', () => {
  describe('getSpotifyAuthUrl', () => {
    it('should generate a valid Spotify auth URL', () => {
      const url = getSpotifyAuthUrl(
        'test-client-id',
        'https://example.com/callback',
        'test-state-123'
      );

      expect(url).toContain('https://accounts.spotify.com/authorize');
      expect(url).toContain('client_id=test-client-id');
      expect(url).toContain('redirect_uri=https%3A%2F%2Fexample.com%2Fcallback');
      expect(url).toContain('state=test-state-123');
    });

    it('should include required scopes', () => {
      const url = getSpotifyAuthUrl('client', 'redirect', 'state');

      expect(url).toContain('user-library-read');
      expect(url).toContain('playlist-modify-public');
      expect(url).toContain('playlist-modify-private');
    });
  });
});

describe('Genre Extraction Logic', () => {
  it('should extract unique genres from artist data', () => {
    const artistGenreMap = new Map<string, string[]>([
      ['artist1', ['rock', 'alternative rock']],
      ['artist2', ['pop', 'dance pop']],
      ['artist3', ['rock', 'indie rock']],
    ]);

    const allGenres = new Set<string>();
    for (const genres of artistGenreMap.values()) {
      genres.forEach(g => allGenres.add(g));
    }

    expect(allGenres.size).toBe(5);
    expect(allGenres.has('rock')).toBe(true);
  });

  it('should count tracks per genre correctly', () => {
    const tracks = [
      { id: '1', artists: [{ id: 'a1' }] },
      { id: '2', artists: [{ id: 'a1' }, { id: 'a2' }] },
      { id: '3', artists: [{ id: 'a2' }] },
    ];

    const artistGenres = new Map([
      ['a1', ['rock']],
      ['a2', ['pop', 'rock']],
    ]);

    const genreCounts = new Map<string, number>();

    for (const track of tracks) {
      const trackGenres = new Set<string>();
      for (const artist of track.artists) {
        const genres = artistGenres.get(artist.id) || [];
        genres.forEach(g => trackGenres.add(g));
      }
      for (const genre of trackGenres) {
        genreCounts.set(genre, (genreCounts.get(genre) || 0) + 1);
      }
    }

    expect(genreCounts.get('rock')).toBe(3);
    expect(genreCounts.get('pop')).toBe(2);
  });

  it('should sort genres by track count descending', () => {
    const genres = [
      { name: 'indie', count: 5 },
      { name: 'rock', count: 20 },
      { name: 'pop', count: 15 },
    ];

    const sorted = [...genres].sort((a, b) => b.count - a.count);

    expect(sorted[0].name).toBe('rock');
    expect(sorted[1].name).toBe('pop');
    expect(sorted[2].name).toBe('indie');
  });
});

describe('Playlist Creation', () => {
  it('should chunk track URIs for batch operations', () => {
    const trackIds = Array.from({ length: 250 }, (_, i) => `track${i}`);
    const trackUris = trackIds.map(id => `spotify:track:${id}`);

    const chunks: string[][] = [];
    for (let i = 0; i < trackUris.length; i += 100) {
      chunks.push(trackUris.slice(i, i + 100));
    }

    expect(chunks.length).toBe(3);
    expect(chunks[0].length).toBe(100);
    expect(chunks[2].length).toBe(50);
  });

  it('should format track URIs correctly', () => {
    const trackId = 'abc123xyz';
    const uri = `spotify:track:${trackId}`;

    expect(uri).toBe('spotify:track:abc123xyz');
  });
});

describe('Artist Chunking', () => {
  it('should chunk artist IDs into groups of 50', () => {
    const artistIds = Array.from({ length: 175 }, (_, i) => `artist${i}`);

    const chunks: string[][] = [];
    for (let i = 0; i < artistIds.length; i += 50) {
      chunks.push(artistIds.slice(i, i + 50));
    }

    expect(chunks.length).toBe(4);
    expect(chunks[0].length).toBe(50);
    expect(chunks[3].length).toBe(25);
  });
});
```

vitest.config.ts
```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      exclude: ['node_modules/**', 'dist/**', '**/*.test.ts'],
    },
    environment: 'node',
  },
});
```

wrangler.toml
```toml
name = "spotify-genre-sorter"
main = "src/index.ts"
compatibility_date = "2024-11-01"

# Custom domain configuration (optional)
# Uncomment and set your zone_id to enable custom domain
# [[routes]]
# pattern = "spotify.houstons.tech/*"
# zone_id = "YOUR_ZONE_ID"

# KV Namespace for storing sessions and tokens
[[kv_namespaces]]
binding = "SESSIONS"
id = "YOUR_KV_NAMESPACE_ID"

# Environment variables (set these in Cloudflare dashboard or use wrangler secret)
# GITHUB_CLIENT_ID = ""
# GITHUB_CLIENT_SECRET = ""
# SPOTIFY_CLIENT_ID = ""
# SPOTIFY_CLIENT_SECRET = ""
# ALLOWED_GITHUB_USERS = "username1,username2"
# SESSION_SECRET = "random-32-char-string"

[vars]
ALLOWED_GITHUB_USERS = ""
```

Assistant:
Failed to send prompt via First Party API: Error: Invalid Google AI API Key. Please enter a valid API Key in Settings.