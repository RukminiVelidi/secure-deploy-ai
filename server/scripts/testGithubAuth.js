// Run from the server folder: node scripts/testGithubAuth.js <installationId>
// Tests each step of GitHub App auth in isolation so you can see exactly
// which part is failing instead of a single opaque 500 error.
require('dotenv').config();

const installationId = process.argv[2];
if (!installationId) {
  console.error('Usage: node scripts/testGithubAuth.js <installationId>');
  process.exit(1);
}

async function main() {
  console.log('--- Step 1: loading private key ---');
  let key;
  try {
    const { createAppAuth } = require('@octokit/auth-app');
    if (process.env.GITHUB_APP_PRIVATE_KEY_BASE64) {
      key = Buffer.from(process.env.GITHUB_APP_PRIVATE_KEY_BASE64.trim(), 'base64').toString('utf-8').trim();
    } else {
      key = (process.env.GITHUB_APP_PRIVATE_KEY || '').trim().replace(/\\n/g, '\n');
    }
    console.log('Key starts with:', key.slice(0, 30));
    console.log('Key ends with:', key.slice(-30));
    if (!key.includes('BEGIN') || !key.includes('PRIVATE KEY')) {
      console.error('❌ Decoded key does not look like a valid PEM. Re-copy the base64 value.');
      return;
    }
    console.log('✅ Key looks structurally valid\n');

    console.log('--- Step 2: generating app-level JWT ---');
    const appAuth = createAppAuth({
      appId: process.env.GITHUB_APP_ID,
      privateKey: key + '\n',
      clientId: process.env.GITHUB_APP_CLIENT_ID,
      clientSecret: process.env.GITHUB_APP_CLIENT_SECRET
    });
    const appToken = await appAuth({ type: 'app' });
    console.log('✅ App JWT generated OK\n');

    console.log(`--- Step 3: getting installation token for installationId=${installationId} ---`);
    const installAuth = await appAuth({ type: 'installation', installationId: Number(installationId) });
    console.log('✅ Installation token obtained\n');

    console.log('--- Step 4: listing repos for this installation ---');
    const { Octokit } = require('@octokit/rest');
    const octokit = new Octokit({ auth: installAuth.token });
    const { data } = await octokit.request('GET /installation/repositories');
    console.log(`✅ Found ${data.total_count} repo(s):`, data.repositories.map(r => r.full_name));
  } catch (err) {
    console.error('\n❌ FAILED at the step above this line.');
    console.error('Error message:', err.message);
    if (err.response?.data) console.error('GitHub response:', JSON.stringify(err.response.data, null, 2));
  }
}

main();
