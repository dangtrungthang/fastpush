const { Router } = require('express');
const { PrismaClient } = require('@prisma/client');
const path = require('path');
const fs = require('fs');

const router = Router();
const prisma = new PrismaClient();

function matchVersion(target, actual) {
  const targetParts = target.split('.');
  const actualParts = actual.split('.');

  for (let i = 0; i < targetParts.length; i++) {
    if (targetParts[i] === 'x' || targetParts[i] === '*') continue;
    if (targetParts[i] !== actualParts[i]) return false;
  }
  return true;
}

router.post('/check', async (req, res) => {
  try {
    const { deploymentKey, appVersion, currentHash } = req.body;
    if (!deploymentKey || !appVersion) {
      return res.status(400).json({ error: 'deploymentKey and appVersion are required' });
    }

    const app = await prisma.app.findUnique({ where: { deploymentKey } });
    if (!app) {
      return res.status(404).json({ error: 'Invalid deployment key' });
    }

    const releases = await prisma.release.findMany({
      where: { appId: app.id, isDisabled: false },
      orderBy: { version: 'desc' },
    });

    const latest = releases.find((r) => matchVersion(r.targetVersion, appVersion));

    if (!latest || latest.hash === currentHash) {
      return res.json({ updateAvailable: false });
    }

    res.json({
      updateAvailable: true,
      id: latest.id,
      version: latest.version,
      type: latest.type,
      hash: latest.hash,
      fileSize: latest.fileSize,
      isMandatory: latest.isMandatory,
      description: latest.description,
      downloadUrl: `/api/update/download/${latest.id}`,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/download/:releaseId', async (req, res) => {
  try {
    const release = await prisma.release.findUnique({
      where: { id: req.params.releaseId },
    });
    if (!release) return res.status(404).json({ error: 'Release not found' });

    const absolutePath = path.resolve(release.filePath);
    if (!fs.existsSync(absolutePath)) {
      return res.status(404).json({ error: 'File not found on server' });
    }

    await prisma.release.update({
      where: { id: release.id },
      data: { downloadCount: { increment: 1 } },
    });

    const ext = path.extname(absolutePath);
    const filename = `bundle-v${release.version}${ext}`;
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('X-Bundle-Hash', release.hash);

    const stream = fs.createReadStream(absolutePath);
    stream.pipe(res);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
