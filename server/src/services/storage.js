const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function saveFile(file, appId) {
  const appDir = path.join(UPLOAD_DIR, appId);
  ensureDir(appDir);

  const ext = path.extname(file.originalname) || '.zip';
  const filename = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}${ext}`;
  const destPath = path.join(appDir, filename);

  fs.renameSync(file.path, destPath);

  return destPath;
}

function getFileHash(filePath) {
  const content = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(content).digest('hex');
}

function deleteFile(filePath) {
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}

module.exports = { saveFile, getFileHash, deleteFile, ensureDir };
