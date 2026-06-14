const { Router } = require('express');
const { PrismaClient } = require('@prisma/client');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

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

// Deterministic rollout bucket: hash(deviceId + releaseId) % 100
function inRollout(deviceId, releaseId, percent) {
  if (percent >= 100) return true;
  if (percent <= 0) return false;
  const hash = crypto.createHash('md5').update(`${deviceId}:${releaseId}`).digest('hex');
  const bucket = parseInt(hash.slice(0, 8), 16) % 100;
  return bucket < percent;
}

router.post('/check', async (req, res) => {
  try {
    const { deploymentKey, appVersion, currentHash, deviceId } = req.body;
    if (!deploymentKey || !appVersion) {
      return res.status(400).json({ error: 'deploymentKey and appVersion are required' });
    }

    const app = await prisma.app.findUnique({ where: { deploymentKey } });
    if (!app) return res.status(404).json({ error: 'Invalid deployment key' });

    const releases = await prisma.release.findMany({
      where: { appId: app.id, isDisabled: false, rolledBackAt: null },
      orderBy: { version: 'desc' },
    });

    // Find latest matching release that this device qualifies for
    const latest = releases.find((r) => {
      if (!matchVersion(r.targetVersion, appVersion)) return false;
      if (deviceId && !inRollout(deviceId, r.id, r.rolloutPercent)) return false;
      return true;
    });

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
    const release = await prisma.release.findUnique({ where: { id: req.params.releaseId } });
    if (!release) return res.status(404).json({ error: 'Release not found' });

    const absolutePath = path.resolve(release.filePath);
    if (!fs.existsSync(absolutePath)) return res.status(404).json({ error: 'File not found on server' });

    await prisma.release.update({
      where: { id: release.id },
      data: { downloadCount: { increment: 1 } },
    });

    const ext = path.extname(absolutePath);
    res.setHeader('Content-Disposition', `attachment; filename="bundle-v${release.version}${ext}"`);
    res.setHeader('X-Bundle-Hash', release.hash);
    fs.createReadStream(absolutePath).pipe(res);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Device reports install status: installed | failed
router.post('/report', async (req, res) => {
  try {
    const { releaseId, deviceId, status, appVersion } = req.body;
    if (!releaseId || !deviceId || !status) {
      return res.status(400).json({ error: 'releaseId, deviceId, status are required' });
    }
    if (!['pending', 'downloading', 'installed', 'failed'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const release = await prisma.release.findUnique({ where: { id: releaseId } });
    if (!release) return res.status(404).json({ error: 'Release not found' });

    const existing = await prisma.deviceInstall.findUnique({
      where: { releaseId_deviceId: { releaseId, deviceId } },
    });

    if (existing) {
      await prisma.deviceInstall.update({
        where: { id: existing.id },
        data: { status, appVersion },
      });
    } else {
      await prisma.deviceInstall.create({
        data: { releaseId, deviceId, status, appVersion: appVersion || '' },
      });
    }

    // Update aggregate counters
    if (status === 'installed' && existing?.status !== 'installed') {
      await prisma.release.update({ where: { id: releaseId }, data: { installCount: { increment: 1 } } });
    }
    if (status === 'failed' && existing?.status !== 'failed') {
      await prisma.release.update({ where: { id: releaseId }, data: { failCount: { increment: 1 } } });
    }

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
