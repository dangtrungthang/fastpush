const { Router } = require('express');
const { PrismaClient } = require('@prisma/client');
const multer = require('multer');
const auth = require('../middleware/auth');
const { saveFile, getFileHash } = require('../services/storage');

const router = Router();
const prisma = new PrismaClient();
const upload = multer({ dest: '/tmp/fastpush-uploads' });

router.use(auth);

router.post('/:appId/releases', upload.single('file'), async (req, res) => {
  try {
    const app = await prisma.app.findFirst({
      where: { id: req.params.appId, userId: req.userId },
    });
    if (!app) return res.status(404).json({ error: 'App not found' });

    if (!req.file) {
      return res.status(400).json({ error: 'File is required' });
    }

    const { targetVersion, type = 'bundle', description, isMandatory } = req.body;
    if (!targetVersion) {
      return res.status(400).json({ error: 'targetVersion is required' });
    }

    const filePath = saveFile(req.file, app.id);
    const hash = getFileHash(filePath);

    const lastRelease = await prisma.release.findFirst({
      where: { appId: app.id },
      orderBy: { version: 'desc' },
    });

    const release = await prisma.release.create({
      data: {
        appId: app.id,
        version: (lastRelease?.version || 0) + 1,
        targetVersion,
        type,
        filePath,
        fileSize: req.file.size,
        hash,
        description: description || null,
        isMandatory: isMandatory === 'true' || isMandatory === true,
      },
    });

    res.status(201).json(release);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:appId/releases', async (req, res) => {
  try {
    const app = await prisma.app.findFirst({
      where: { id: req.params.appId, userId: req.userId },
    });
    if (!app) return res.status(404).json({ error: 'App not found' });

    const releases = await prisma.release.findMany({
      where: { appId: app.id },
      orderBy: { version: 'desc' },
    });

    res.json(releases);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/:appId/releases/:releaseId/toggle', async (req, res) => {
  try {
    const app = await prisma.app.findFirst({
      where: { id: req.params.appId, userId: req.userId },
    });
    if (!app) return res.status(404).json({ error: 'App not found' });

    const release = await prisma.release.findFirst({
      where: { id: req.params.releaseId, appId: app.id },
    });
    if (!release) return res.status(404).json({ error: 'Release not found' });

    const updated = await prisma.release.update({
      where: { id: release.id },
      data: { isDisabled: !release.isDisabled },
    });

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
