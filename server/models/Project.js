const mongoose = require('mongoose');

const ProjectSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

  repoName: { type: String, required: true }, // "owner/repo" for github sources, or a display name for uploads
  repoUrl: { type: String, default: '' },
  repoId: { type: Number, default: null }, // GitHub numeric repo id

  // How this project's code is accessed:
  //  - github_app: via the installed GitHub App (full read/write, PRs, webhooks)
  //  - public:     unauthenticated read of a public repo (no install needed, no PR/webhook — read-only)
  //  - upload:     a one-off manual zip upload, scanned once, no ongoing repo connection at all
  source: { type: String, enum: ['github_app', 'public', 'upload'], default: 'github_app' },

  // GitHub App installation that has access to this repo — only set for source:'github_app'.
  installationId: { type: Number, default: null },

  defaultBranch: { type: String, default: 'main' },
  webhookConfigured: { type: Boolean, default: true }, // App-level webhooks cover all installed repos automatically

  // Empty array = scan every supported file. Non-empty = only scan these exact
  // paths going forward (manual scans, webhook-triggered scans, everything) —
  // set via the repo file/folder picker on connect, editable later.
  selectedPaths: { type: [String], default: [] },

  settings: {
    checkSecrets: { type: Boolean, default: true },
    checkEnv: { type: Boolean, default: true },
    checkDeps: { type: Boolean, default: true },
    checkDebug: { type: Boolean, default: true },
    checkConsole: { type: Boolean, default: true },
    checkTodos: { type: Boolean, default: true },
    checkVulnerabilities: { type: Boolean, default: true },
    autoOpenFixPRs: { type: Boolean, default: true } // one PR per fixable finding
  },

  createdAt: { type: Date, default: Date.now }
});

ProjectSchema.index({ userId: 1, repoName: 1 }, { unique: true });

module.exports = mongoose.model('Project', ProjectSchema);
