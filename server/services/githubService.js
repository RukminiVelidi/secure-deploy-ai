const { getInstallationOctokit } = require('./githubAppAuth');
const { isSupported } = require('../utils/fileExtensions');

const MAX_FULL_REPO_FILES = 300; // cap for "scan the whole repo" — keeps a single scan bounded and fast

async function getFileContent(octokit, owner, repo, path, ref) {
  try {
    const { data } = await octokit.request('GET /repos/{owner}/{repo}/contents/{path}', {
      owner, repo, path, ref
    });
    if (Array.isArray(data)) return null; // it's a directory
    return Buffer.from(data.content, 'base64').toString('utf-8');
  } catch {
    return null;
  }
}

/**
 * Flat list of every file in the repo at a given branch/ref — powers the
 * file/folder picker in Settings/Dashboard so the user can choose exactly what
 * gets scanned instead of SecureDeploy AI guessing from the latest commit's diff.
 */
async function getRepoTree(installationId, repoName, branch) {
  const octokit = await getInstallationOctokit(installationId);
  const [owner, repo] = repoName.split('/');
  const ref = branch || (await octokit.request('GET /repos/{owner}/{repo}', { owner, repo })).data.default_branch;

  const { data } = await octokit.request('GET /repos/{owner}/{repo}/git/trees/{tree_sha}', {
    owner, repo, tree_sha: ref, recursive: '1'
  });

  return data.tree
    .filter(node => node.type === 'blob' && isSupported(node.path))
    .map(node => ({ path: node.path, size: node.size }));
}

/** Fetch content for an explicit list of file paths — used once the user has picked specific files. */
async function getFilesByPaths(installationId, repoName, paths, ref) {
  const octokit = await getInstallationOctokit(installationId);
  const [owner, repo] = repoName.split('/');
  const files = [];
  for (const filepath of paths) {
    const content = await getFileContent(octokit, owner, repo, filepath, ref);
    if (content !== null) files.push({ path: filepath, content });
  }
  return files;
}

/**
 * "Scan everything" default — used for manual/first scans instead of only looking
 * at the latest commit's diff, which was under-scanning repos that hadn't had a
 * recent commit touch most of their files. Capped at MAX_FULL_REPO_FILES so a
 * single scan stays bounded on very large repos.
 */
async function getAllRepoFiles(installationId, repoName, branch) {
  const tree = await getRepoTree(installationId, repoName, branch);
  const capped = tree.slice(0, MAX_FULL_REPO_FILES);
  const paths = capped.map(f => f.path);
  const octokit = await getInstallationOctokit(installationId);
  const [owner, repo] = repoName.split('/');
  const resolvedBranch = branch || (await octokit.request('GET /repos/{owner}/{repo}', { owner, repo })).data.default_branch;
  const files = await getFilesByPaths(installationId, repoName, paths, resolvedBranch);
  return { files, branch: resolvedBranch, truncated: tree.length > MAX_FULL_REPO_FILES, totalAvailable: tree.length };
}

/** Files changed in a push webhook event. */
async function getFilesFromPush(installationId, payload) {
  const octokit = await getInstallationOctokit(installationId);
  const [owner, repo] = payload.repository.full_name.split('/');
  const files = [];
  const commits = payload.commits || [];

  for (const commit of commits) {
    const changed = [...(commit.added || []), ...(commit.modified || [])];
    for (const filepath of changed) {
      if (!isSupported(filepath)) continue;
      const content = await getFileContent(octokit, owner, repo, filepath, commit.id);
      if (content !== null) files.push({ path: filepath, content });
    }
  }
  return files;
}

/** Files touched in a pull_request webhook event. */
async function getFilesFromPR(installationId, repoName, prNumber, headSha) {
  const octokit = await getInstallationOctokit(installationId);
  const [owner, repo] = repoName.split('/');
  const { data: prFiles } = await octokit.request('GET /repos/{owner}/{repo}/pulls/{pull_number}/files', {
    owner, repo, pull_number: prNumber
  });
  const files = [];
  for (const f of prFiles) {
    if (f.status === 'removed' || !isSupported(f.filename)) continue;
    const content = await getFileContent(octokit, owner, repo, f.filename, headSha);
    if (content !== null) files.push({ path: f.filename, content });
  }
  return files;
}

/** For manual "Scan Now" — grab whatever changed in the latest commit on the default branch. */
async function getLatestCommitFiles(installationId, repoName) {
  const octokit = await getInstallationOctokit(installationId);
  const [owner, repo] = repoName.split('/');

  const { data: repoData } = await octokit.request('GET /repos/{owner}/{repo}', { owner, repo });
  const branch = repoData.default_branch;

  const { data: commits } = await octokit.request('GET /repos/{owner}/{repo}/commits', {
    owner, repo, sha: branch, per_page: 1
  });
  const sha = commits[0]?.sha;
  if (!sha) return { files: [], sha: null, branch };

  const { data: commitData } = await octokit.request('GET /repos/{owner}/{repo}/commits/{ref}', {
    owner, repo, ref: sha
  });

  const files = [];
  for (const file of commitData.files || []) {
    if (!isSupported(file.filename)) continue;
    const content = await getFileContent(octokit, owner, repo, file.filename, sha);
    if (content !== null) files.push({ path: file.filename, content });
  }
  return { files, sha, branch };
}

async function postPRComment(installationId, repoName, prNumber, report) {
  const octokit = await getInstallationOctokit(installationId);
  const [owner, repo] = repoName.split('/');
  const findings = report.findings.slice(0, 10);
  const emoji = { Low: '✅', Medium: '⚠️', High: '❌' }[report.riskLevel] || '';

  const body = `## 🛡️ SecureDeploy AI Scan Report
**Risk Score:** ${report.riskScore} | **Level:** ${emoji} ${report.riskLevel} | **Status:** ${report.status === 'blocked' ? '❌ BLOCKED' : '✅ ALLOWED'}

### Summary
${report.gptSummary}

### Findings (${report.findings.length} total)
${findings.map(f => `- **${f.type}** in \`${f.file}\` (line ${f.line || 'N/A'}): ${f.message}${f.prUrl ? `\n  > 🔧 Fix PR: ${f.prUrl}` : ''}`).join('\n')}
${report.findings.length > 10 ? `\n_...and ${report.findings.length - 10} more. View full report in SecureDeploy AI dashboard._` : ''}`;

  try {
    await octokit.request('POST /repos/{owner}/{repo}/issues/{issue_number}/comments', {
      owner, repo, issue_number: prNumber, body
    });
  } catch (e) {
    console.error('PR comment failed:', e.message);
  }
}

async function setCommitStatus(installationId, repoName, sha, status, description) {
  const octokit = await getInstallationOctokit(installationId);
  const [owner, repo] = repoName.split('/');
  try {
    await octokit.request('POST /repos/{owner}/{repo}/statuses/{sha}', {
      owner, repo, sha,
      state: status === 'blocked' ? 'failure' : 'success',
      description: description || `SecureDeploy AI: ${status}`,
      context: 'securedeployai/security-scan'
    });
  } catch (e) {
    console.error('Status check failed:', e.message);
  }
}

module.exports = {
  getRepoTree,
  getFilesByPaths,
  getAllRepoFiles,
  getFilesFromPush,
  getFilesFromPR,
  getLatestCommitFiles,
  postPRComment,
  setCommitStatus,
  isSupported
};
