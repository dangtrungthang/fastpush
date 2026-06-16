const { Router } = require('express');
const { PrismaClient } = require('@prisma/client');
const multer = require('multer');
const auth = require('../middleware/auth');
const { requireRole, findAppForUser } = require('../middleware/rbac');
const { saveFile, getFileHash } = require('../services/storage');
const activity = require('../services/activity');

const router = Router();
const prisma = new PrismaClient();

const upload = multer({ dest: '/tmp/fastpush-uploads' });

router.use(auth);

// Verify user can access app for a given deploymentId
async function getDeploymentWithAccess(deploymentId, userId, minRole = 'viewer') {
  const deployment = await prisma.deployment.findUnique({
    where: { id: deploymentId },
    include: { app: true },
  });
  if (!deployment) return null;

  const result = await findAppForUser(deployment.appId, userId);
  if (!result) return null;

  const ROLE_LEVELS = { owner: 3, collaborator: 2, viewer: 1 };
  if ((ROLE_LEVELS[result.role] || 0) < (ROLE_LEVELS[minRole] || 0)) return null;

  return { deployment, role: result.role };
}

// POST /api/apps/:appId/releases — upload release to a deployment
router.post('/:appId/releases', upload.single('file'), async (req, res) => {
  try {
    const result = await findAppForUser(req.params.appId, req.userId);
    if (!result) return res.status(404).json({ error: 'App not found' });
    if (!['owner', 'collaborator'].includes(result.role)) return res.status(403).json({ error: 'Requires collaborator role' });
    if (!req.file) return res.status(400).json({ error: 'File is required' });

    const { targetVersion, type = 'bundle', description, isMandatory, rolloutPercent = 100, deploymentId, targetDevices } = req.body;
    if (!targetVersion) return res.status(400).json({ error: 'targetVersion is required' });

    const targetDeviceIds = String(targetDevices || '').split(',').map((s) => s.trim()).filter(Boolean);
    const targetMode = targetDeviceIds.length > 0 ? 'devices' : 'all';

    // Resolve deployment: use provided deploymentId or default to Production
    let resolvedDeploymentId = deploymentId;
    if (!resolvedDeploymentId) {
      const prod = await prisma.deployment.findFirst({
        where: { appId: req.params.appId, name: 'Production' },
      });
      if (prod) resolvedDeploymentId = prod.id;
    } else {
      const dep = await prisma.deployment.findFirst({
        where: { id: deploymentId, appId: req.params.appId },
      });
      if (!dep) return res.status(404).json({ error: 'Deployment not found' });
    }

    const filePath = saveFile(req.file, req.params.appId);
    const hash = getFileHash(filePath);

    const lastRelease = await prisma.release.findFirst({
      where: { deployment: { appId: req.params.appId } },
      orderBy: { version: 'desc' },
    });

    const release = await prisma.release.create({
      data: {
        deploymentId: resolvedDeploymentId || null,
        version: (lastRelease?.version || 0) + 1,
        targetVersion,
        type,
        filePath,
        fileSize: req.file.size,
        hash,
        description: description || null,
        isMandatory: isMandatory === 'true' || isMandatory === true,
        rolloutPercent: Math.min(100, Math.max(0, parseInt(rolloutPercent) || 100)),
        targetMode,
        targetDeviceIds,
      },
    });

    await activity.log(req.params.appId, req.userId, 'release.create', {
      version: release.version,
      targetVersion,
      type,
      deploymentId: resolvedDeploymentId,
    });

    res.status(201).json(release);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/apps/:appId/releases — all releases across all deployments (legacy + new)
router.get('/:appId/releases', async (req, res) => {
  try {
    const result = await findAppForUser(req.params.appId, req.userId);
    if (!result) return res.status(404).json({ error: 'App not found' });

    const releases = await prisma.release.findMany({
      where: { deployment: { appId: req.params.appId } },
      orderBy: { version: 'desc' },
      include: { deployment: { select: { id: true, name: true } } },
    });
    res.json(releases);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/apps/:appId/releases/:depId — releases for a specific deployment
router.get('/:appId/releases/:depId', async (req, res) => {
  try {
    const result = await findAppForUser(req.params.appId, req.userId);
    if (!result) return res.status(404).json({ error: 'App not found' });

    const dep = await prisma.deployment.findFirst({
      where: { id: req.params.depId, appId: req.params.appId },
    });
    if (!dep) return res.status(404).json({ error: 'Deployment not found' });

    const releases = await prisma.release.findMany({
      where: { deploymentId: req.params.depId },
      orderBy: { version: 'desc' },
    });
    res.json(releases);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/apps/:appId/releases/:releaseId/toggle
router.patch('/:appId/releases/:releaseId/toggle', async (req, res) => {
  try {
    const result = await findAppForUser(req.params.appId, req.userId);
    if (!result) return res.status(404).json({ error: 'App not found' });
    if (!['owner', 'collaborator'].includes(result.role)) return res.status(403).json({ error: 'Requires collaborator role' });

    const release = await prisma.release.findFirst({
      where: { id: req.params.releaseId, deployment: { appId: req.params.appId } },
    });
    if (!release) return res.status(404).json({ error: 'Release not found' });

    const updated = await prisma.release.update({
      where: { id: release.id },
      data: { isDisabled: !release.isDisabled },
    });

    await activity.log(req.params.appId, req.userId, updated.isDisabled ? 'release.disable' : 'release.enable', { version: release.version });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/apps/:appId/releases/:releaseId/rollout
router.patch('/:appId/releases/:releaseId/rollout', async (req, res) => {
  try {
    const result = await findAppForUser(req.params.appId, req.userId);
    if (!result) return res.status(404).json({ error: 'App not found' });
    if (!['owner', 'collaborator'].includes(result.role)) return res.status(403).json({ error: 'Requires collaborator role' });

    const { rolloutPercent } = req.body;
    if (rolloutPercent === undefined) return res.status(400).json({ error: 'rolloutPercent is required' });

    const release = await prisma.release.findFirst({
      where: { id: req.params.releaseId, deployment: { appId: req.params.appId } },
    });
    if (!release) return res.status(404).json({ error: 'Release not found' });

    const pct = Math.min(100, Math.max(0, parseInt(rolloutPercent)));
    const updated = await prisma.release.update({
      where: { id: release.id },
      data: { rolloutPercent: pct },
    });

    await activity.log(req.params.appId, req.userId, 'release.rollout_change', { version: release.version, rolloutPercent: pct });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/apps/:appId/releases/:releaseId/target
router.patch('/:appId/releases/:releaseId/target', async (req, res) => {
  try {
    const result = await findAppForUser(req.params.appId, req.userId);
    if (!result) return res.status(404).json({ error: 'App not found' });
    if (!['owner', 'collaborator'].includes(result.role)) return res.status(403).json({ error: 'Requires collaborator role' });

    const { targetMode, targetDeviceIds, targetGroupId } = req.body;
    if (!['all', 'devices', 'group'].includes(targetMode)) return res.status(400).json({ error: 'targetMode must be "all", "devices" or "group"' });
    if (targetMode === 'devices' && !Array.isArray(targetDeviceIds)) return res.status(400).json({ error: 'targetDeviceIds must be an array' });
    if (targetMode === 'group' && !targetGroupId) return res.status(400).json({ error: 'targetGroupId is required for group mode' });

    const release = await prisma.release.findFirst({
      where: { id: req.params.releaseId, deployment: { appId: req.params.appId } },
    });
    if (!release) return res.status(404).json({ error: 'Release not found' });

    if (targetMode === 'group') {
      const group = await prisma.deviceGroup.findFirst({
        where: { id: targetGroupId, appId: req.params.appId },
      });
      if (!group) return res.status(404).json({ error: 'Device group not found' });
    }

    const updated = await prisma.release.update({
      where: { id: release.id },
      data: {
        targetMode,
        targetDeviceIds: targetMode === 'devices' ? targetDeviceIds : [],
        targetGroupId: targetMode === 'group' ? targetGroupId : null,
      },
    });

    await activity.log(req.params.appId, req.userId, 'release.target_change', { version: release.version, targetMode, targetDeviceIds: updated.targetDeviceIds, targetGroupId: updated.targetGroupId });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/apps/:appId/releases/:releaseId/rollback — rollback specific release
router.post('/:appId/releases/:releaseId/rollback', async (req, res) => {
  try {
    const result = await findAppForUser(req.params.appId, req.userId);
    if (!result) return res.status(404).json({ error: 'App not found' });
    if (!['owner', 'collaborator'].includes(result.role)) return res.status(403).json({ error: 'Requires collaborator role' });

    const current = await prisma.release.findFirst({
      where: { id: req.params.releaseId, deployment: { appId: req.params.appId } },
    });
    if (!current) return res.status(404).json({ error: 'Release not found' });
    if (current.rolledBackAt) return res.status(400).json({ error: 'Release already rolled back' });

    const previous = await prisma.release.findFirst({
      where: {
        deploymentId: current.deploymentId,
        version: { lt: current.version },
        isDisabled: false,
        rolledBackAt: null,
      },
      orderBy: { version: 'desc' },
    });

    await prisma.$transaction([
      prisma.release.update({
        where: { id: current.id },
        data: { rolledBackAt: new Date(), isDisabled: true },
      }),
      ...(previous ? [prisma.release.update({
        where: { id: previous.id },
        data: { rolledBackFrom: current.id },
      })] : []),
    ]);

    await activity.log(req.params.appId, req.userId, 'release.rollback', {
      fromVersion: current.version,
      toVersion: previous?.version || null,
    });

    res.json({ message: `Rolled back v${current.version}`, previous: previous || null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Legacy rollback endpoint (used by CLI)
router.post('/:appId/rollback', async (req, res) => {
  try {
    const result = await findAppForUser(req.params.appId, req.userId);
    if (!result) return res.status(404).json({ error: 'App not found' });
    if (!['owner', 'collaborator'].includes(result.role)) return res.status(403).json({ error: 'Requires collaborator role' });

    const { deploymentName = 'Production' } = req.body;
    const dep = await prisma.deployment.findFirst({
      where: { appId: req.params.appId, name: deploymentName },
    });
    if (!dep) return res.status(404).json({ error: `Deployment "${deploymentName}" not found` });

    const releases = await prisma.release.findMany({
      where: { deploymentId: dep.id, isDisabled: false, rolledBackAt: null },
      orderBy: { version: 'desc' },
    });
    if (releases.length < 2) return res.status(400).json({ error: 'Need at least 2 active releases to rollback' });

    const current = releases[0];
    const previous = releases[1];

    await prisma.$transaction([
      prisma.release.update({ where: { id: current.id }, data: { isDisabled: true, rolledBackAt: new Date() } }),
      prisma.release.update({ where: { id: previous.id }, data: { rolledBackFrom: current.id } }),
    ]);

    await activity.log(req.params.appId, req.userId, 'release.rollback', { fromVersion: current.version, toVersion: previous.version });
    res.json({ message: `Rolled back from v${current.version} to v${previous.version}`, previous });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/apps/:appId/releases/:releaseId/analytics
router.get('/:appId/releases/:releaseId/analytics', async (req, res) => {
  try {
    const result = await findAppForUser(req.params.appId, req.userId);
    if (!result) return res.status(404).json({ error: 'App not found' });

    const release = await prisma.release.findFirst({
      where: { id: req.params.releaseId, deployment: { appId: req.params.appId } },
    });
    if (!release) return res.status(404).json({ error: 'Release not found' });

    const byStatus = await prisma.deviceInstall.groupBy({
      by: ['status'],
      where: { releaseId: release.id },
      _count: true,
    });

    res.json({
      releaseId: release.id,
      version: release.version,
      downloadCount: release.downloadCount,
      installCount: release.installCount,
      failCount: release.failCount,
      byStatus: Object.fromEntries(byStatus.map((s) => [s.status, s._count])),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
