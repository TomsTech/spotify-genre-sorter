#!/usr/bin/env node
/**
 * Script to configure Cloudflare Logpush for Workers Trace Events
 * Uses wrangler's authentication to make API calls
 */

import { spawn } from 'child_process';
import { readFileSync } from 'fs';

const ACCOUNT_ID = 'df52a0cfc6c1765f726a830ef84ba78c';
const BETTERSTACK_HOST = 's1616980.eu-nbg-2.betterstackdata.com';
const BETTERSTACK_TOKEN = 'bjS8g5FPFeDxCVHBHxCzHPFr';
const DATASET = 'workers_trace_events';
const WORKER_NAME = 'spotify-genre-sorter';

// Get OAuth access token from wrangler
async function getAccessToken() {
  return new Promise((resolve, reject) => {
    // Use wrangler's internal token exchange
    // We can't directly access the token, so we'll use a workaround
    // by checking if wrangler is authenticated and proceeding with the API call
    const wrangler = spawn('npx', ['wrangler', 'whoami'], {
      shell: true,
      cwd: process.cwd()
    });

    let output = '';
    wrangler.stdout.on('data', (data) => {
      output += data.toString();
    });

    wrangler.on('close', (code) => {
      if (code === 0 && output.includes('OAuth Token')) {
        resolve('authenticated');
      } else {
        reject(new Error('Not authenticated with wrangler'));
      }
    });
  });
}

// Create logpush job using curl with wrangler's auth
async function createLogpushJob() {
  console.log('🔧 Setting up Cloudflare Logpush for Workers Trace Events...\n');

  // Check if authenticated
  try {
    await getAccessToken();
    console.log('✅ Wrangler authentication confirmed\n');
  } catch (e) {
    console.error('❌ Please run "npx wrangler login" first');
    process.exit(1);
  }

  // Construct the BetterStack destination URL
  const destinationUrl = `https://${BETTERSTACK_HOST}?header_Authorization=Bearer%20${BETTERSTACK_TOKEN}`;

  console.log('📝 Logpush Configuration:');
  console.log(`   Account ID: ${ACCOUNT_ID}`);
  console.log(`   Dataset: ${DATASET}`);
  console.log(`   Worker: ${WORKER_NAME}`);
  console.log(`   Destination: BetterStack (${BETTERSTACK_HOST})`);
  console.log('');

  // The logpush job payload
  const jobPayload = {
    name: `${WORKER_NAME}-traces-to-betterstack`,
    destination_conf: destinationUrl,
    dataset: DATASET,
    enabled: true,
    output_options: {
      field_names: [
        'Event',
        'EventTimestampMs',
        'Outcome',
        'Exceptions',
        'Logs',
        'ScriptName',
        'ScriptVersion'
      ]
    },
    filter: {
      where: {
        key: 'ScriptName',
        operator: 'eq',
        value: WORKER_NAME
      }
    }
  };

  console.log('📤 Logpush Job Payload:');
  console.log(JSON.stringify(jobPayload, null, 2));
  console.log('');
  console.log('⚠️  To create this logpush job, you need to:');
  console.log('   1. Go to Cloudflare Dashboard > Analytics & Logs > Logs');
  console.log('   2. Click "Add Logpush job"');
  console.log('   3. Select "Workers Trace Events" dataset');
  console.log(`   4. Set destination URL to: ${destinationUrl}`);
  console.log('   5. Enable the job');
  console.log('');
  console.log('Or use the Cloudflare API with an API token that has Logs:Edit permission.');
}

createLogpushJob().catch(console.error);
