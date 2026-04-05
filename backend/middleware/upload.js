const admin = require('firebase-admin');
const multer = require('multer');

// Initialize Firebase Admin (App Hosting does this automatically if you omit config)
if (!admin.apps.length) {
  admin.initializeApp();
}

const bucket = admin.storage().bucket(process.env.FIREBASE_STORAGE_BUCKET);

// 1. Use Memory Storage (holds file in buffer before sending to Firebase)
const storage = multer.memoryStorage();

// 2. Helper function to actually push the buffer to Firebase
const uploadToFirebase = async (file, folder) => {
  const fileName = `${folder}/${Date.now()}_${file.originalname.replace(/\s+/g, '_')}`;
  const blob = bucket.file(fileName);
  
  const blobStream = blob.createWriteStream({
    metadata: { contentType: file.mimetype },
    resumable: false
  });

  return new Promise((resolve, reject) => {
    blobStream.on('error', (err) => reject(err));
    blobStream.on('finish', async () => {
      // Make public so we can get a direct URL
      await blob.makePublic();
      const publicUrl = `https://storage.googleapis.com/${bucket.name}/${blob.name}`;
      resolve(publicUrl);
    });
    blobStream.end(file.buffer);
  });
};

// 3. Keep your existing export names so your routes don't break
exports.uploadProductImages = multer({ storage }).array('images', 6);
exports.uploadAvatar = multer({ storage }).single('avatar');
exports.uploadVendorLogo = multer({ storage }).fields([
  { name: 'logo', maxCount: 1 },
  { name: 'banner', maxCount: 1 },
]);
exports.uploadCategoryImage = multer({ storage }).single('image');

// Export the helper for use in your Controllers
exports.uploadToFirebase = uploadToFirebase;