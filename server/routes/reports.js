const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const ScanReport = require('../models/ScanReport');
const Project = require('../models/Project');
const User = require('../models/User');
const { generateReportPDF } = require('../services/reportPdfService');
const { sendReportEmail } = require('../services/emailService');

// All reports across every project the user owns — powers the standalone
// History tab (as opposed to /project/:projectId, which is per-repo history).
router.get('/', auth, async (req, res) => {
  try {
    const projects = await Project.find({ userId: req.user.id });
    const projectMap = Object.fromEntries(projects.map(p => [p._id.toString(), p]));
    const reports = await ScanReport.find({ projectId: { $in: projects.map(p => p._id) } })
      .sort({ createdAt: -1 })
      .limit(200);
    const withRepoInfo = reports.map(r => ({
      ...r.toObject(),
      repoName: projectMap[r.projectId.toString()]?.repoName || 'Unknown',
      source: projectMap[r.projectId.toString()]?.source || 'github_app'
    }));
    res.json(withRepoInfo);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/project/:projectId', auth, async (req, res) => {
  try {
    const project = await Project.findOne({ _id: req.params.projectId, userId: req.user.id });
    if (!project) return res.status(404).json({ message: 'Not found' });
    const reports = await ScanReport.find({ projectId: req.params.projectId }).sort({ createdAt: -1 });
    res.json(reports);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/:id', auth, async (req, res) => {
  try {
    const report = await ScanReport.findById(req.params.id).populate('projectId');
    res.json(report);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Download the report as a PDF. Ownership is checked via the parent project
// (a report has no userId of its own), same pattern used everywhere else.
router.get('/:id/download', auth, async (req, res) => {
  try {
    const report = await ScanReport.findById(req.params.id).populate('projectId');
    if (!report) return res.status(404).json({ message: 'Report not found' });
    if (!report.projectId || report.projectId.userId.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to access this report' });
    }
    const pdfBuffer = await generateReportPDF(report, report.projectId.repoName);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="securedeployai-${report.projectId.repoName.replace(/\//g, '-')}-${report._id}.pdf"`);
    res.send(pdfBuffer);
  } catch (err) {
    console.error('Report download failed:', err.message);
    res.status(500).json({ message: err.message });
  }
});

// Delete a single scan report — used from the History pages and the report view.
router.delete('/:id', auth, async (req, res) => {
  try {
    const report = await ScanReport.findById(req.params.id).populate('projectId');
    if (!report) return res.status(404).json({ message: 'Report not found' });
    if (!report.projectId || report.projectId.userId.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to delete this report' });
    }
    await ScanReport.findByIdAndDelete(req.params.id);
    res.json({ message: 'Report deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Email the report (as a PDF attachment) to whichever address the user has
// configured as their notification preference — same on-demand action as the
// download button, just delivered by email instead.
router.post('/:id/email', auth, async (req, res) => {
  try {
    const report = await ScanReport.findById(req.params.id).populate('projectId');
    if (!report) return res.status(404).json({ message: 'Report not found' });
    if (!report.projectId || report.projectId.userId.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to access this report' });
    }
    const user = await User.findById(req.user.id);
    const toEmail = user?.resolveNotificationEmail();
    if (!toEmail) return res.status(400).json({ message: 'No email address on file' });

    const pdfBuffer = await generateReportPDF(report, report.projectId.repoName);
    await sendReportEmail(toEmail, report.projectId.repoName, report, pdfBuffer);
    res.json({ message: `Report emailed to ${toEmail}` });
  } catch (err) {
    console.error('Report email failed:', err.message);
    res.status(500).json({ message: err.message });
  }
});

router.get('/stats/overview', auth, async (req, res) => {
  try {
    const projects = await Project.find({ userId: req.user.id });
    const projectIds = projects.map(p => p._id);
    const totalScans = await ScanReport.countDocuments({ projectId: { $in: projectIds } });
    const blocked = await ScanReport.countDocuments({ projectId: { $in: projectIds }, status: 'blocked' });
    const allReports = await ScanReport.find({ projectId: { $in: projectIds } });
    const typeCounts = {};
    allReports.forEach(r => r.findings.forEach(f => {
      typeCounts[f.type] = (typeCounts[f.type] || 0) + 1;
    }));
    const mostCommon = Object.entries(typeCounts).sort((a, b) => b[1] - a[1])[0];
    res.json({ totalScans, blocked, mostCommonIssue: mostCommon ? mostCommon[0] : 'None' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
