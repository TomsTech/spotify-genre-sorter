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

  // Validate accountId format to prevent command injection (must be 32 hex chars)
  if (accountId && !/^[a-f0-9]{32}$/i.test(accountId)) {
    log.error('Invalid account ID format');
    process.exit(1);
  }

  try {
    // First check if it already exists
    let existingOutput;
    if (apiToken) {
      // Use fetch API instead of shell command to avoid injection
      const response = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${accountId}/storage/kv/namespaces`,
        { headers: { Authorization: `Bearer ${apiToken}` } }
      );
      existingOutput = await response.text();
    } else {
      existingOutput = execSync('npx wrangler kv:namespace list', { encoding: 'utf8' });
    }

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
