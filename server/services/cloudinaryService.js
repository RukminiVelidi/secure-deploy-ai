const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const FOLDER = process.env.CLOUDINARY_AVATAR_FOLDER || 'securedeployai/avatars';

function uploadAvatar(buffer, userId) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: FOLDER,
        public_id: `user_${userId}`,
        overwrite: true,
        transformation: [{ width: 256, height: 256, crop: 'fill', gravity: 'face' }]
      },
      (err, result) => (err ? reject(err) : resolve(result))
    );
    stream.end(buffer);
  });
}

function deleteAvatar(publicId) {
  return cloudinary.uploader.destroy(publicId);
}

module.exports = { uploadAvatar, deleteAvatar };
