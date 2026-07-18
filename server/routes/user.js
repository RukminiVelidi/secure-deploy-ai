const express = require('express');
const router = express.Router();
const multer = require('multer');
const auth = require('../middleware/auth');
const User = require('../models/User');
const { uploadAvatar, deleteAvatar } = require('../services/cloudinaryService');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) return cb(new Error('File must be an image'));
    cb(null, true);
  }
});

function publicUser(user) {
  return {
    id: user._id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl,
    theme: user.theme,
    emailPreference: user.emailPreference,
    githubUsername: user.githubUsername,
    githubEmail: user.githubEmail,
    githubInstallations: user.githubInstallations
  };
}

// --- Current user profile ---
router.get('/me', auth, async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) return res.status(404).json({ message: 'User not found' });
  res.json(publicUser(user));
});

// --- Update name ---
router.patch('/profile', auth, async (req, res) => {
  const { name } = req.body;
  const user = await User.findByIdAndUpdate(req.user.id, { name }, { new: true });
  res.json(publicUser(user));
});

// --- Theme (persisted per-account, not localStorage, so it follows the user across devices) ---
router.patch('/theme', auth, async (req, res) => {
  const { theme } = req.body;
  if (!['light', 'dark'].includes(theme)) return res.status(400).json({ message: 'Invalid theme' });
  const user = await User.findByIdAndUpdate(req.user.id, { theme }, { new: true });
  res.json({ theme: user.theme });
});

// --- Which email address scan alerts should go to: their own profile email, or GitHub's ---
router.patch('/email-preference', auth, async (req, res) => {
  const { emailPreference } = req.body;
  if (!['profile', 'github'].includes(emailPreference)) {
    return res.status(400).json({ message: 'Invalid preference' });
  }
  const user = await User.findByIdAndUpdate(req.user.id, { emailPreference }, { new: true });
  res.json({ emailPreference: user.emailPreference });
});

// --- Avatar upload ---
router.post('/avatar', auth, upload.single('avatar'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file provided' });
    const user = await User.findById(req.user.id);

    const result = await uploadAvatar(req.file.buffer, user._id.toString());

    // Clean up the old uploaded avatar (not the GitHub default one) so Cloudinary doesn't pile up.
    if (user.avatarPublicId) {
      deleteAvatar(user.avatarPublicId).catch(() => {});
    }

    user.avatarUrl = result.secure_url;
    user.avatarPublicId = result.public_id;
    await user.save();

    res.json({ avatarUrl: user.avatarUrl });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
