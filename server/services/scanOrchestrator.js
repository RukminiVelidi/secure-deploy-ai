const { scanFile, scanEnvUsage, scanForHighEntropyStrings, scanVulnerabilities } = require('./scanner');
const { checkDependencies } = require('./dependencyChecker');
const { getGptExplanations, classifyAmbiguousFindings } = require('./gptService');
const { calculateRisk } = require('./riskEngine');
const {
  getFilesFromPush, getFilesFromPR, getAllRepoFiles, postPRComment, setCommitStatus
} = require('./githubService');
const { getAllPublicRepoFiles } = require('./publicGithubService');
const { openFixPRsForReport } = require('./prService');
const { sendHighRiskEmail } = require('./emailService');
const { generateReportPDF } = require('./reportPdfService');
const ScanReport = require('../models/ScanReport');
const User = require('../models/User');

/** If the project has a specific file selection, only scan those — otherwise scan everything fetched. */
function applySelection(files, selectedPaths) {
  if (!selectedPaths || selectedPaths.length === 0) return files;
  const selected = new Set(selectedPaths);
  return files.filter(f => selected.has(f.path));
}

/**
 * Sends low-confidence entropy findings through the Groq second-opinion pass,
 * drops anything classified LIKELY_NOT_SECRET, and promotes confirmed ones to
 * higher confidence. This is the "dynamic beyond hardcoded patterns" layer —
 * signatures catch known formats, this catches everything else that merely
 * *looks* like a secret and lets an LLM use context to decide.
 */
async function resolveAmbiguousFindings(allFindings, files) {
  const entropyFindings = allFindings.filter(f => f.detectionMethod === 'entropy');
  if (entropyFindings.length === 0) return allFindings;

  const candidates = entropyFindings.map(f => {
    const file = files.find(x => x.path === f.file);
    const lines = file ? file.content.split('\n') : [];
    const contextStart = Math.max(0, (f.line || 1) - 3);
    const contextEnd = Math.min(lines.length, (f.line || 1) + 2);
    return { file: f.file, line: f.line, context: lines.slice(contextStart, contextEnd).join('\n') };
  });

  const verdicts = await classifyAmbiguousFindings(candidates);

  const kept = [];
  entropyFindings.forEach((f, i) => {
    const verdict = verdicts.find(v => v.index === i)?.verdict || 'UNCERTAIN';
    if (verdict === 'LIKELY_NOT_SECRET') return; // drop — false positive
    kept.push({
      ...f,
      confidence: verdict === 'LIKELY_SECRET' ? 'high' : 'medium',
      message: `${f.message} — AI review: ${verdict}`
    });
  });

  return [...allFindings.filter(f => f.detectionMethod !== 'entropy'), ...kept];
}

async function runFullScan(project, webhookPayload, preloadedFiles) {
  let files = [];
  let commitSha = 'manual';
  let branch = project.defaultBranch || 'main';
  let prNumber = null;

  if (project.source === 'upload') {
    // Files were already extracted from the uploaded zip — nothing to fetch.
    files = preloadedFiles || [];
    commitSha = 'upload';
    branch = 'n/a';
  } else if (project.source === 'public') {
    const owner = await User.findById(project.userId);
    const token = owner?.getGithubAccessToken();
    const result = await getAllPublicRepoFiles(project.repoName, branch, token);
    files = applySelection(result.files, project.selectedPaths);
    branch = result.branch || branch;
  } else if (webhookPayload) {
    if (webhookPayload.pull_request) {
      prNumber = webhookPayload.pull_request.number;
      commitSha = webhookPayload.pull_request.head.sha;
      branch = webhookPayload.pull_request.head.ref;
      files = applySelection(
        await getFilesFromPR(project.installationId, project.repoName, prNumber, commitSha),
        project.selectedPaths
      );
    } else {
      commitSha = webhookPayload.after;
      branch = webhookPayload.ref?.replace('refs/heads/', '') || branch;
      files = applySelection(
        await getFilesFromPush(project.installationId, webhookPayload),
        project.selectedPaths
      );
    }
  } else {
    // Manual "Scan Now" — scan the FULL repo tree (capped), not just the latest
    // commit's diff. The old behavior under-scanned repos whose recent commits
    // only touched a handful of files.
    const result = await getAllRepoFiles(project.installationId, project.repoName, branch);
    files = applySelection(result.files, project.selectedPaths);
    branch = result.branch || branch;
  }

  const envFile = files.find(f => f.path === '.env' || f.path.endsWith('/.env'));
  const packageJson = files.find(f => f.path === 'package.json');

  let allFindings = [];
  for (const file of files) {
    if (file.path.endsWith('.env')) continue;
    const settings = project.settings || {};
    if (settings.checkSecrets !== false) allFindings.push(...scanFile(file.path, file.content));
    if (settings.checkEnv !== false) allFindings.push(...scanEnvUsage(file.path, file.content, envFile?.content || ''));
    if (settings.checkSecrets !== false) allFindings.push(...scanForHighEntropyStrings(file.path, file.content));
    if (settings.checkVulnerabilities !== false) allFindings.push(...scanVulnerabilities(file.path, file.content));
  }

  if (packageJson && project.settings?.checkDeps !== false) {
    allFindings.push(...await checkDependencies(packageJson.content));
  }

  // AI second-opinion pass on ambiguous entropy hits
  allFindings = await resolveAmbiguousFindings(allFindings, files);

  // AI explanations + fixability + exact fix diffs
  const gptResult = await getGptExplanations(allFindings);
  let enrichedFindings = allFindings.map((f, i) => {
    const gpt = gptResult.findings.find(g => g.index === i);
    return {
      ...f,
      gptExplanation: gpt?.explanation || '',
      gptFix: gpt?.fix || '',
      gptFixDiff: gpt?.fixDiff || '',
      fixable: !!gpt?.fixable && !!gpt?.fixDiff
    };
  });

  const { score, level, status } = calculateRisk(enrichedFindings);

  let report = await ScanReport.create({
    projectId: project._id,
    commitSha,
    branch,
    filesScanned: files.length,
    findings: enrichedFindings,
    riskScore: score,
    riskLevel: level,
    status,
    gptSummary: gptResult.summary
  });

  // Open one PR per fixable finding (user reviews + merges manually) — only possible
  // when we actually have write access via the installed GitHub App.
  if (project.source === 'github_app' && project.settings?.autoOpenFixPRs !== false) {
    const fixable = enrichedFindings.filter(f => f.fixable);
    if (fixable.length > 0) {
      const prResults = await openFixPRsForReport(
        project.installationId, project.repoName, branch, fixable, report._id.toString()
      );
      // Write PR urls back onto the matching findings in the saved report
      report.findings = report.findings.map(f => {
        const match = prResults.find(r => r.finding.file === f.file && r.finding.line === f.line && r.finding.type === f.type);
        if (match) {
          f.prUrl = match.prResult.url || '';
          f.prStatus = match.prResult.status === 'opened' ? 'opened' : match.prResult.status === 'failed' ? 'failed' : 'none';
        }
        return f;
      });
      await report.save();
    }
  }

  // GitHub commit status + PR comment — same restriction, App-installed repos only.
  if (project.source === 'github_app' && commitSha !== 'manual') {
    await setCommitStatus(project.installationId, project.repoName, commitSha, status, `Risk: ${level} (${score} pts)`);
    if (prNumber) {
      await postPRComment(project.installationId, project.repoName, prNumber, report);
    }
  }

  // Email notification on high risk, sent to whichever address the user prefers
  if (level === 'High') {
    const user = await User.findById(project.userId);
    if (user) {
      const to = user.resolveNotificationEmail();
      const pdfBuffer = await generateReportPDF(report, project.repoName).catch(() => null);
      await sendHighRiskEmail(to, project.repoName, score, report._id.toString(), pdfBuffer);
    }
  }

  return report;
}

module.exports = { runFullScan };
