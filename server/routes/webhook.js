const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const Project = require('../models/Project');
const { runFullScan } = require('../services/scanOrchestrator');

function verifySignature(req) {
  const sig = req.headers['x-hub-signature-256'];
  if (!sig) return false;
  const hmac = crypto.createHmac('sha256', process.env.GITHUB_WEBHOOK_SECRET);
  const digest = 'sha256=' + hmac.update(req.body).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(digest));
  } catch {
    return false; // length mismatch etc.
  }
}

router.post('/', async (req, res) => {
  if (!verifySignature(req)) {
    return res.status(401).json({ message: 'Invalid signature' });
  }

  const event = req.headers['x-github-event'];
  const payload = JSON.parse(req.body.toString());

  // App-level lifecycle events (install/uninstall/repo added) — acknowledge, no scan.
  if (event === 'installation' || event === 'installation_repositories') {
    return res.status(200).json({ message: 'Installation event acknowledged' });
  }

  if (!['push', 'pull_request'].includes(event)) {
    return res.status(200).json({ message: 'Event ignored' });
  }

  // Only act on meaningful PR activity, not every PR webhook sub-type
  if (event === 'pull_request' && !['opened', 'synchronize', 'reopened'].includes(payload.action)) {
    return res.status(200).json({ message: 'PR action ignored' });
  }

  const repoFullName = payload.repository?.full_name;
  const installationId = payload.installation?.id;
  if (!repoFullName || !installationId) return res.status(200).json({ message: 'No repo/installation' });

  const projects = await Project.find({ repoName: repoFullName, installationId });
  if (projects.length === 0) return res.status(200).json({ message: 'No matching connected project' });

  // Respond to GitHub immediately — scanning can take a while (Groq calls, PR creation)
  res.status(200).json({ message: 'Scan started' });

  for (const project of projects) {
    try {
      await runFullScan(project, payload);
    } catch (err) {
      console.error(`Scan error for ${repoFullName}:`, err.message);
    }
  }
});

module.exports = router;
