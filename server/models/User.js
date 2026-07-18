const mongoose = require('mongoose');
const { decrypt } = require('../utils/crypto');

const UserSchema = new mongoose.Schema({
  // Local auth (optional now — a user can exist via GitHub only)
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String }, // not required if user only ever signs in via GitHub

  name: { type: String, default: '' },
  avatarUrl: { type: String, default: '' },
  avatarPublicId: { type: String, default: '' }, // cloudinary public_id, so we can delete/replace cleanly

  // GitHub identity (set once the user connects/installs the GitHub App)
  githubId: { type: Number, default: null, index: true },
  githubUsername: { type: String, default: '' },
  githubEmail: { type: String, default: '' },
  githubAvatarUrl: { type: String, default: '' },
  githubAccessTokenEnc: { type: String, default: '' }, // encrypted — see utils/crypto.js

  // One user can have the App installed on multiple orgs/accounts
  githubInstallations: [
    {
      installationId: { type: Number, required: true },
      accountLogin: { type: String, required: true },
      accountType: { type: String, enum: ['User', 'Organization'], default: 'User' }
    }
  ],

  // Preferences
  theme: { type: String, enum: ['light', 'dark'], default: 'dark' },
  emailPreference: { type: String, enum: ['profile', 'github'], default: 'profile' },

  createdAt: { type: Date, default: Date.now }
});

// Resolve which address a scan report / alert email should go to,
// based on the user's chosen preference, falling back sensibly.
UserSchema.methods.resolveNotificationEmail = function () {
  if (this.emailPreference === 'github' && this.githubEmail) return this.githubEmail;
  return this.email || this.githubEmail;
};

// Used for public repo browsing/reads — swaps the shared 60/hr unauthenticated
// GitHub rate limit for the much higher 5,000/hr per-user authenticated limit.
UserSchema.methods.getGithubAccessToken = function () {
  try {
    return decrypt(this.githubAccessTokenEnc);
  } catch {
    return ''; // ENCRYPTION_KEY missing/changed, or nothing stored — fall back to unauthenticated
  }
};

module.exports = mongoose.model('User', UserSchema);
