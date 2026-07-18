const { createAppAuth } = require('@octokit/auth-app');
const { Octokit } = require('@octokit/rest');
const axios = require('axios');

function loadPrivateKey() {
  if (process.env.GITHUB_APP_PRIVATE_KEY_BASE64) {
    const key = Buffer.from(process.env.GITHUB_APP_PRIVATE_KEY_BASE64.trim(), 'base64').toString('utf-8').trim();
    if (!key.includes('BEGIN') || !key.includes('PRIVATE KEY')) {
      throw new Error('GITHUB_APP_PRIVATE_KEY_BASE64 did not decode to a valid PEM — re-copy the base64 output with no extra whitespace/newlines');
    }
    return key + '\n';
  }
  if (process.env.GITHUB_APP_PRIVATE_KEY) {
    // Render/most host env editors store literal "\n" — convert back to real newlines.
    return process.env.GITHUB_APP_PRIVATE_KEY.trim().replace(/\\n/g, '\n') + '\n';
  }
  throw new Error('No GitHub App private key configured (GITHUB_APP_PRIVATE_KEY or _BASE64)');
}

const appAuth = createAppAuth({
  appId: process.env.GITHUB_APP_ID,
  privateKey: loadPrivateKey(),
  clientId: process.env.GITHUB_APP_CLIENT_ID,
  clientSecret: process.env.GITHUB_APP_CLIENT_SECRET
});

/**
 * Returns an Octokit instance authenticated as a specific installation
 * (i.e. scoped to whichever repos that installation was granted access to).
 * This is what replaces personal access tokens for all repo read/write/PR operations.
 */
async function getInstallationOctokit(installationId) {
  const auth = await appAuth({ type: 'installation', installationId });
  return new Octokit({ auth: auth.token });
}

/**
 * Step 2 of the GitHub OAuth web flow: exchange the `code` GitHub redirected back
 * with for a short-lived user access token, and fetch that user's identity.
 * This is ONLY used to know *who* connected (so we can link the User doc to a
 * GitHub identity + get their GitHub email) — it is never used for repo access,
 * installation tokens handle that.
 */
async function exchangeCodeForUser(code) {
  const tokenRes = await axios.post(
    'https://github.com/login/oauth/access_token',
    {
      client_id: process.env.GITHUB_APP_CLIENT_ID,
      client_secret: process.env.GITHUB_APP_CLIENT_SECRET,
      code
    },
    { headers: { Accept: 'application/json' } }
  );

  if (tokenRes.data.error) {
    throw new Error(tokenRes.data.error_description || tokenRes.data.error);
  }

  const userAccessToken = tokenRes.data.access_token;
  const octokit = new Octokit({ auth: userAccessToken });

  const { data: ghUser } = await octokit.request('GET /user');

  // Primary verified email may be private, needs the separate emails endpoint
  let primaryEmail = ghUser.email || '';
  try {
    const { data: emails } = await octokit.request('GET /user/emails');
    const primary = emails.find(e => e.primary && e.verified);
    if (primary) primaryEmail = primary.email;
  } catch {
    // /user/emails needs user:email scope — if missing, fall back to ghUser.email
  }

  return {
    githubId: ghUser.id,
    githubUsername: ghUser.login,
    githubEmail: primaryEmail,
    githubAvatarUrl: ghUser.avatar_url,
    accessToken: userAccessToken
  };
}

/**
 * List installations accessible to a user access token — used right after
 * install/OAuth to figure out which installationId(s) belong to this user.
 */
async function listUserInstallations(userAccessToken) {
  const octokit = new Octokit({ auth: userAccessToken });
  const { data } = await octokit.request('GET /user/installations');
  return data.installations.map(i => ({
    installationId: i.id,
    accountLogin: i.account.login,
    accountType: i.account.type
  }));
}

/**
 * List repos a given installation can access — powers the "connect a repo" picker,
 * replacing the old manual repoUrl + PAT form entirely.
 */
async function listInstallationRepos(installationId) {
  const octokit = await getInstallationOctokit(installationId);
  const repos = await octokit.paginate('GET /installation/repositories');
  return repos.map(r => ({
    repoId: r.id,
    repoName: r.full_name,
    repoUrl: r.html_url,
    defaultBranch: r.default_branch,
    private: r.private
  }));
}

module.exports = {
  getInstallationOctokit,
  exchangeCodeForUser,
  listUserInstallations,
  listInstallationRepos
};
