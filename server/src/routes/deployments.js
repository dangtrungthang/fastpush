const { Router } = require('express');
const { PrismaClient } = require('@prisma/client');
const auth = require('../middleware/auth');
const { requireRole, findAppForUser } = require('../middleware/rbac');
const activity = require('../services/activity');

const router = Router({ mergeParams: true });
const prisma = new PrismaClient();

router.use(auth);

// GET /api/apps/:appId/deployments
router.get('/', requireRole('viewer'), async (req, res) => {
  try {
    const deployments = await prisma.deployment.findMany({
      where: { appId: req.params.appId },
      include: {
        _count: { select: { releases: true } },
        releases: {
          where: { isDisabled: false, rolledBackAt: null },
          orderBy: { version: 'desc' },
          take: 1,
          select: { id: true, version: true, description: true, rolloutPercent: true, isMandatory: true, createdAt: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
    res.json(deployments);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/apps/:appId/deployments
router.post('/', requireRole('collaborator'), async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });

    const deployment = await prisma.deployment.create({
      data: { appId: req.params.appId, name },
    });

    await activity.log(req.params.appId, req.userId, 'deployment.create', { name });
    res.status(201).json(deployment);
  } catch (err) {
    if (err.code === 'P2002') return res.status(409).json({ error: 'Deployment with this name already exists' });
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/apps/:appId/deployments/:id
router.delete('/:id', requireRole('owner'), async (req, res) => {
  try {
    const deployment = await prisma.deployment.findFirst({
      where: { id: req.params.id, appId: req.params.appId },
    });
    if (!deployment) return res.status(404).json({ error: 'Deployment not found' });
    if (['Production', 'Staging'].includes(deployment.name)) {
      return res.status(400).json({ error: 'Cannot delete default deployments' });
    }

    const releases = await prisma.release.findMany({ where: { deploymentId: req.params.id }, select: { id: true } });
    const releaseIds = releases.map((r) => r.id);

    await prisma.$transaction([
      prisma.deviceInstall.deleteMany({ where: { releaseId: { in: releaseIds } } }),
      prisma.release.deleteMany({ where: { deploymentId: req.params.id } }),
      prisma.deployment.delete({ where: { id: req.params.id } }),
    ]);

    await activity.log(req.params.appId, req.userId, 'deployment.delete', { name: deployment.name });
    res.json({ message: 'Deployment deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
