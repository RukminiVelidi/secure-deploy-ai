const { getInstallationOctokit } = require('./githubAppAuth');

function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 40);
}

/**
 * Opens ONE pull request for a single finding — never commits directly to a
 * real branch. The user reviews the diff in GitHub's normal PR UI and merges
 * (or closes) it themselves; SecureDeploy AI never pushes to main/master.
 *
 * Only findings the AI marked `fixable: true` (a safe, mechanical code change —
 * e.g. hardcoded value -> process.env.X) reach this function. Findings that need
 * an actual credential rotation are never auto-PR'd, since there's no code-level
 * fix for a leaked key — that has to happen at the provider (Stripe/AWS/etc).
 */
async function openFixPR(installationId, repoName, defaultBranch, finding, reportId) {
  const octokit = await getInstallationOctokit(installationId);
  const [owner, repo] = repoName.split('/');

  const branchName = `securedeployai/fix-${slugify(finding.type)}-${finding.file.split('/').pop()}-${Date.now().toString(36)}`;

  try {
    // 1. Get the current file + its blob sha, and the base branch's latest commit sha
    const { data: baseRef } = await octokit.request('GET /repos/{owner}/{repo}/git/ref/{ref}', {
      owner, repo, ref: `heads/${defaultBranch}`
    });
    const baseSha = baseRef.object.sha;

    const { data: fileData } = await octokit.request('GET /repos/{owner}/{repo}/contents/{path}', {
      owner, repo, path: finding.file, ref: defaultBranch
    });
    const originalContent = Buffer.from(fileData.content, 'base64').toString('utf-8');

    // 2. Apply the fix — replace the flagged line with the AI-suggested replacement.
    if (!finding.gptFixDiff) return { status: 'failed', reason: 'No fix diff available' };
    const lines = originalContent.split('\n');
    if (!finding.line || finding.line < 1 || finding.line > lines.length) {
      return { status: 'failed', reason: 'Finding line number out of range' };
    }
    lines[finding.line - 1] = finding.gptFixDiff;
    const newContent = lines.join('\n');

    // 3. Create the branch off the base
    await octokit.request('POST /repos/{owner}/{repo}/git/refs', {
      owner, repo, ref: `refs/heads/${branchName}`, sha: baseSha
    });

    // 4. Commit the fix to the new branch
    await octokit.request('PUT /repos/{owner}/{repo}/contents/{path}', {
      owner, repo, path: finding.file,
      message: `fix: resolve ${finding.type} in ${finding.file} (SecureDeploy AI)`,
      content: Buffer.from(newContent).toString('base64'),
      sha: fileData.sha,
      branch: branchName
    });

    // 5. Open the PR
    const { data: pr } = await octokit.request('POST /repos/{owner}/{repo}/pulls', {
      owner, repo,
      title: `🛡️ SecureDeploy AI fix: ${finding.type} in ${finding.file}`,
      head: branchName,
      base: defaultBranch,
      body: `**Automated fix suggestion from SecureDeploy AI**

**Finding:** ${finding.message}
**File:** \`${finding.file}\` (line ${finding.line})
**Severity:** ${finding.severity}

### Explanation
${finding.gptExplanation || 'N/A'}

### Suggested fix
\`\`\`diff
- ${lines[finding.line - 1] !== finding.gptFixDiff ? 'original line' : ''}
+ ${finding.gptFixDiff}
\`\`\`

Review the diff carefully before merging — this PR was opened automatically but **nothing is merged without your approval**.

_Related scan report: ${process.env.CLIENT_URL}/reports/${reportId}_`
    });

    return { status: 'opened', url: pr.html_url };
  } catch (err) {
    console.error(`PR creation failed for ${finding.file}:`, err.message);
    return { status: 'failed', reason: err.message };
  }
}

/**
 * Runs openFixPR for every fixable finding in a report, sequentially (to stay
 * well under GitHub's abuse-rate limits when a scan has many findings).
 */
async function openFixPRsForReport(installationId, repoName, defaultBranch, findings, reportId) {
  const results = [];
  for (const finding of findings) {
    if (!finding.fixable || !finding.gptFixDiff) {
      results.push({ finding, prResult: { status: 'none' } });
      continue;
    }
    const prResult = await openFixPR(installationId, repoName, defaultBranch, finding, reportId);
    results.push({ finding, prResult });
  }
  return results;
}

module.exports = { openFixPR, openFixPRsForReport };
