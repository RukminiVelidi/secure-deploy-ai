const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const auth = require('../middleware/auth');
const User = require('../models/User');
const {
  exchangeCodeForUser,
  listUserInstallations,
  listInstallationRepos
} = require('../services/githubAppAuth');
const { listPublicRepos, searchPublicRepos, getPublicRepoTree } = require('../services/publicGithubService');
const { getRepoTree } = require('../services/githubService');
const { encrypt } = require('../utils/crypto');

const GITHUB_AUTHORIZE_URL = 'https://github.com/login/oauth/authorize';

// Short-lived signed "state" so the callback knows what to do and, if the
// person was already logged in (e.g. connecting from Settings), who they are.
function makeState(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '10m' });
}
function readState(state) {
  try {
    return jwt.verify(state, process.env.JWT_SECRET);
  } catch {
    return null;
  }
}

// --- Step 1: front-end asks us for the URL to send the browser to ---
// intent: 'login' (Login page, no existing session) or 'connect' (Settings page, already logged in)
router.get('/oauth-url', (req, res) => {
  const intent = req.query.intent === 'connect' ? 'connect' : 'login';
  const userId = intent === 'connect' ? req.query.userId : undefined;

  const state = makeState({ intent, userId });
  const redirectUri = `${process.env.BACKEND_URL}/api/github/callback`;

  const url = `${GITHUB_AUTHORIZE_URL}?client_id=${process.env.GITHUB_APP_CLIENT_ID}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&state=${state}` +
    `&scope=${encodeURIComponent('read:user user:email')}`;

  res.json({ url });
});

// --- Step 1b: front-end asks for the URL to install the GitHub App on a repo/org ---
router.get('/install-url', auth, (req, res) => {
  const state = makeState({ intent: 'connect', userId: req.user.id });
  const slug = process.env.GITHUB_APP_SLUG || 'internshield';
  res.json({
    url: `https://github.com/apps/${slug}/installations/new?state=${state}`
  });
});

// --- Step 2: GitHub redirects back here after OAuth consent AND/OR after App install ---
// Query params vary by flow:
//  - Pure OAuth login:     ?code=...&state=...
//  - App install:          ?installation_id=...&setup_action=install&state=...
//  - Install w/ OAuth:     ?code=...&installation_id=...&setup_action=install&state=...
router.get('/callback', async (req, res) => {
  const { code, installation_id, state } = req.query;
  const parsedState = readState(state);
  const clientUrl = process.env.CLIENT_URL;

  try {
    let user = null;

    // If we're connecting to an already-logged-in account, load that user first.
    if (parsedState?.intent === 'connect' && parsedState.userId) {
      user = await User.findById(parsedState.userId);
    }

    // If GitHub gave us an auth `code`, exchange it for identity info.
    let ghIdentity = null;
    if (code) {
      ghIdentity = await exchangeCodeForUser(code);
    }

    if (!user && ghIdentity) {
      // Login/signup flow: find existing user by githubId, else by matching email, else create new.
      user = await User.findOne({ githubId: ghIdentity.githubId });
      if (!user && ghIdentity.githubEmail) {
        user = await User.findOne({ email: ghIdentity.githubEmail });
      }
      if (!user) {
        user = await User.create({
          email: ghIdentity.githubEmail || `${ghIdentity.githubUsername}@users.noreply.github.com`,
          name: ghIdentity.githubUsername
        });
      }
    }

    if (!user) {
      return res.redirect(`${clientUrl}/login?error=github_auth_failed`);
    }

    if (ghIdentity) {
      user.githubId = ghIdentity.githubId;
      user.githubUsername = ghIdentity.githubUsername;
      user.githubEmail = ghIdentity.githubEmail;
      user.githubAvatarUrl = ghIdentity.githubAvatarUrl;
      if (!user.avatarUrl) user.avatarUrl = ghIdentity.githubAvatarUrl; // default avatar if none uploaded
      if (!user.name) user.name = ghIdentity.githubUsername;
      if (ghIdentity.accessToken) {
        try {
          user.githubAccessTokenEnc = encrypt(ghIdentity.accessToken);
        } catch (e) {
          console.error('Could not encrypt GitHub token (ENCRYPTION_KEY missing?):', e.message);
        }
      }
    }

    // If an installation just happened, record it against this user.
    if (installation_id) {
      const installIdNum = Number(installation_id);
      const already = user.githubInstallations.find(i => i.installationId === installIdNum);
      if (!already) {
        // We may not have an accountLogin yet without an extra call; store what we can,
        // repo listing will still work fine keyed off installationId alone.
        user.githubInstallations.push({
          installationId: installIdNum,
          accountLogin: ghIdentity?.githubUsername || 'unknown',
          accountType: 'User'
        });
      }
    }

    await user.save();

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });

    // Hand the JWT to the frontend via a one-time redirect (not a query param on a page
    // that gets logged/cached long-term — frontend reads it once and stores it, then the
    // URL is replaced via history.replaceState).
    return res.redirect(`${clientUrl}/github/callback?token=${token}`);
  } catch (err) {
    console.error('GitHub callback error:', err.message);
    return res.redirect(`${clientUrl}/login?error=github_auth_failed`);
  }
});

// --- List installations this user has connected ---
router.get('/installations', auth, async (req, res) => {
  const user = await User.findById(req.user.id);
  res.json(user.githubInstallations || []);
});

// --- List repos visible to a given installation, for the "connect a repo" picker ---
router.get('/repos', auth, async (req, res) => {
  try {
    const { installationId } = req.query;
    if (!installationId) return res.status(400).json({ message: 'installationId required' });
    const repos = await listInstallationRepos(Number(installationId));
    res.json(repos);
  } catch (err) {
    console.error('GET /github/repos failed:', err.message);
    if (err.response?.data) console.error('GitHub API response:', JSON.stringify(err.response.data));
    res.status(500).json({ message: err.message });
  }
});

// --- Browse a public account's public repos, or search all of public GitHub — no App install needed ---
router.get('/public-repos', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    const token = user?.getGithubAccessToken();
    const { username, q } = req.query;
    if (q) {
      const repos = await searchPublicRepos(q, token);
      return res.json(repos);
    }
    if (!username) return res.status(400).json({ message: 'username or q is required' });
    const repos = await listPublicRepos(username, token);
    res.json(repos);
  } catch (err) {
    console.error('GET /github/public-repos failed:', err.message);
    res.status(500).json({ message: err.response?.status === 404 ? 'User not found' : err.message });
  }
});

// --- File tree for the picker, GitHub App-authenticated repos ---
router.get('/repo-tree', auth, async (req, res) => {
  try {
    const { installationId, repoName, branch } = req.query;
    if (!installationId || !repoName) return res.status(400).json({ message: 'installationId and repoName are required' });
    const tree = await getRepoTree(Number(installationId), repoName, branch);
    res.json(tree);
  } catch (err) {
    console.error('GET /github/repo-tree failed:', err.message);
    res.status(500).json({ message: err.message });
  }
});

// --- File tree for the picker, public repos (no install needed) ---
router.get('/public-repo-tree', auth, async (req, res) => {
  try {
    const { repoName, branch } = req.query;
    if (!repoName) return res.status(400).json({ message: 'repoName is required' });
    const user = await User.findById(req.user.id);
    const token = user?.getGithubAccessToken();
    const tree = await getPublicRepoTree(repoName, branch, token);
    res.json(tree);
  } catch (err) {
    console.error('GET /github/public-repo-tree failed:', err.message);
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
