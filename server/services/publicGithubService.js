const { Octokit } = require('@octokit/rest');
const { isSupported } = require('../utils/fileExtensions');

const MAX_PUBLIC_FILES = 60;

// Uses the given user token if provided (5,000 req/hr, per-user) — falls back to
// fully unauthenticated (60 req/hr, shared per server IP across every user) only
// when no token is available. Public repo browsing/scanning routes this through
// User.getGithubAccessToken() so anyone who's connected via GitHub OAuth gets
// the much higher limit automatically.
function publicOctokit(token) {
  return token ? new Octokit({ auth: token }) : new Octokit();
}

/** List an account's public, non-fork repos — powers the "browse public repos" picker. */
async function listPublicRepos(username, token) {
  const octokit = publicOctokit(token);
  const { data } = await octokit.request('GET /users/{username}/repos', {
    username, type: 'owner', sort: 'updated', per_page: 50
  });
  return data
    .filter(r => !r.private && !r.fork)
    .map(r => ({
      repoId: r.id,
      repoName: r.full_name,
      repoUrl: r.html_url,
      defaultBranch: r.default_branch,
      description: r.description,
      stars: r.stargazers_count
    }));
}

/** Free-text search across all of public GitHub — e.g. "react starter template". */
async function searchPublicRepos(query, token) {
  const octokit = publicOctokit(token);
  const { data } = await octokit.request('GET /search/repositories', {
    q: query, sort: 'stars', order: 'desc', per_page: 20
  });
  return data.items.map(r => ({
    repoId: r.id,
    repoName: r.full_name,
    repoUrl: r.html_url,
    defaultBranch: r.default_branch,
    description: r.description,
    stars: r.stargazers_count
  }));
}

/** Flat file tree for a public repo — same picker UX as the App-authenticated path. */
async function getPublicRepoTree(repoName, branch, token) {
  const octokit = publicOctokit(token);
  const [owner, repo] = repoName.split('/');
  const ref = branch || (await octokit.request('GET /repos/{owner}/{repo}', { owner, repo })).data.default_branch;

  const { data } = await octokit.request('GET /repos/{owner}/{repo}/git/trees/{tree_sha}', {
    owner, repo, tree_sha: ref, recursive: '1'
  });

  return data.tree
    .filter(node => node.type === 'blob' && isSupported(node.path))
    .map(node => ({ path: node.path, size: node.size }));
}

async function getPublicFilesByPaths(repoName, paths, ref, token) {
  const octokit = publicOctokit(token);
  const [owner, repo] = repoName.split('/');
  const files = [];
  for (const filepath of paths) {
    try {
      const { data } = await octokit.request('GET /repos/{owner}/{repo}/contents/{path}', { owner, repo, path: filepath, ref });
      if (!Array.isArray(data)) files.push({ path: filepath, content: Buffer.from(data.content, 'base64').toString('utf-8') });
    } catch {
      // skip unreadable/binary/removed files
    }
  }
  return files;
}

async function getAllPublicRepoFiles(repoName, branch, token) {
  const tree = await getPublicRepoTree(repoName, branch, token);
  // Authenticated requests get the full 5,000/hr limit, so there's no need to
  // cap as aggressively as the unauthenticated fallback — only clamp hard when
  // running without a token at all.
  const cap = token ? Math.max(MAX_PUBLIC_FILES, 300) : MAX_PUBLIC_FILES;
  const capped = tree.slice(0, cap);
  const octokit = publicOctokit(token);
  const [owner, repo] = repoName.split('/');
  const resolvedBranch = branch || (await octokit.request('GET /repos/{owner}/{repo}', { owner, repo })).data.default_branch;
  const files = await getPublicFilesByPaths(repoName, capped.map(f => f.path), resolvedBranch, token);
  return { files, branch: resolvedBranch, truncated: tree.length > cap, totalAvailable: tree.length };
}

module.exports = {
  listPublicRepos, searchPublicRepos,
  getPublicRepoTree, getPublicFilesByPaths, getAllPublicRepoFiles,
  isSupported
};
