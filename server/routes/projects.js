const express = require('express');
const router = express.Router();
const multer = require('multer');
const AdmZip = require('adm-zip');
const auth = require('../middleware/auth');
const Project = require('../models/Project');
const { isSupported } = require('../utils/fileExtensions');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB cap on uploaded zips
  fileFilter: (req, file, cb) => {
    if (!file.originalname.toLowerCase().endsWith('.zip')) return cb(new Error('Please upload a .zip file'));
    cb(null, true);
  }
});

const SKIP_DIR = ['node_modules/', '.git/', 'dist/', 'build/', '.next/'];

router.get('/', auth, async (req, res) => {
  try {
    const projects = await Project.find({ userId: req.user.id });
    res.json(projects);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Connect a repo the user's GitHub App installation already has access to.
// No token is ever collected from the user — installationId + repoName come
// straight from the /api/github/repos picker.
router.post('/connect', auth, async (req, res) => {
  try {
    const { repoName, repoUrl, repoId, installationId, defaultBranch, paths } = req.body;
    if (!repoName || !repoUrl || !installationId) {
      return res.status(400).json({ message: 'repoName, repoUrl and installationId are required' });
    }
    const existing = await Project.findOne({ userId: req.user.id, repoName });
    if (existing) return res.status(400).json({ message: 'Repository already connected' });

    const project = await Project.create({
      userId: req.user.id,
      repoName,
      repoUrl,
      repoId,
      installationId,
      defaultBranch: defaultBranch || 'main',
      selectedPaths: Array.isArray(paths) ? paths : []
    });
    res.json(project);
  } catch (err) {
    console.error('Connect error:', err.message);
    res.status(500).json({ message: err.message });
  }
});

// Connect a PUBLIC repo for read-only scanning — no GitHub App install needed.
// No PR auto-fix or webhook auto-scan-on-push (those require write access via the App);
// scanning here only happens on-demand via "Scan Now".
router.post('/connect-public', auth, async (req, res) => {
  try {
    const { repoName, repoUrl, repoId, defaultBranch, paths } = req.body;
    if (!repoName || !repoUrl) return res.status(400).json({ message: 'repoName and repoUrl are required' });
    const existing = await Project.findOne({ userId: req.user.id, repoName });
    if (existing) return res.status(400).json({ message: 'Repository already connected' });

    const project = await Project.create({
      userId: req.user.id,
      repoName,
      repoUrl,
      repoId,
      source: 'public',
      defaultBranch: defaultBranch || 'main',
      selectedPaths: Array.isArray(paths) ? paths : [],
      settings: { autoOpenFixPRs: false } // no write access on a public unauthenticated connection
    });
    res.json(project);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Manual upload: extract a zip, scan it immediately, no GitHub involved at all.
// Creates a lightweight Project (source:'upload') purely so the report shows up
// in the normal Dashboard/History UI — there's no ongoing repo connection behind it.
router.post('/upload-scan', auth, upload.single('archive'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No zip file provided' });
    const projectName = (req.body.projectName || req.file.originalname.replace(/\.zip$/i, '')).trim();
    if (!projectName) return res.status(400).json({ message: 'Project name is required' });

    const zip = new AdmZip(req.file.buffer);
    const entries = zip.getEntries();

    const files = [];
    for (const entry of entries) {
      if (entry.isDirectory) continue;
      const entryPath = entry.entryName;
      if (SKIP_DIR.some(dir => entryPath.includes(dir))) continue;
      if (!isSupported(entryPath)) continue;
      if (entry.header.size > 1024 * 1024) continue; // skip anything unusually large per-file (1MB)
      try {
        files.push({ path: entryPath, content: entry.getData().toString('utf-8') });
      } catch {
        // binary or unreadable — skip
      }
    }

    if (files.length === 0) {
      return res.status(400).json({ message: 'No scannable files found in the zip (supported: js/ts/jsx/tsx/json/env/py/rb/go/java/yml)' });
    }

    let project = await Project.findOne({ userId: req.user.id, repoName: projectName, source: 'upload' });
    if (!project) {
      project = await Project.create({
        userId: req.user.id,
        repoName: projectName,
        repoUrl: '',
        source: 'upload',
        settings: { autoOpenFixPRs: false }
      });
    }

    const { runFullScan } = require('../services/scanOrchestrator');
    const report = await runFullScan(project, null, files);
    res.json(report);
  } catch (err) {
    console.error('Upload scan failed:', err.message);
    res.status(500).json({ message: err.message });
  }
});

// Update which specific files a connected repo scans going forward.
// Empty array = back to "scan everything supported".
router.patch('/:id/paths', auth, async (req, res) => {
  try {
    const { paths } = req.body;
    if (!Array.isArray(paths)) return res.status(400).json({ message: 'paths must be an array' });
    const project = await Project.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      { selectedPaths: paths },
      { new: true }
    );
    if (!project) return res.status(404).json({ message: 'Project not found' });
    res.json(project);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.patch('/:id/settings', auth, async (req, res) => {
  try {
    const project = await Project.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      { settings: req.body },
      { new: true }
    );
    res.json(project);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/:id/scan', auth, async (req, res) => {
  try {
    const project = await Project.findOne({ _id: req.params.id, userId: req.user.id });
    if (!project) return res.status(404).json({ message: 'Project not found' });
    if (project.source === 'upload') {
      return res.status(400).json({ message: 'Uploaded projects are scanned once at upload time — upload a fresh zip to re-scan' });
    }
    const { runFullScan } = require('../services/scanOrchestrator');
    const report = await runFullScan(project, null);
    res.json(report);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    await Project.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
    res.json({ message: 'Project removed' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
