const { Router } = require('express');
const { PrismaClient } = require('@prisma/client');
const auth = require('../middleware/auth');
const { findAppForUser } = require('../middleware/rbac');
const activity = require('../services/activity');

const router = Router();
const prisma = new PrismaClient();

router.use(auth);

// Create app — auto-create Production + Staging deployments + owner membership
router.post('/', async (req, res) => {
  try {
    const { name, platform } = req.body;
    if (!name || !platform) return res.status(400).json({ error: 'name and platform are required' });
    if (!['android', 'ios'].includes(platform)) return res.status(400).json({ error: 'platform must be android or ios' });

    const app = await prisma.app.create({
      data: {
        name, platform, userId: req.userId,
        deployments: {
          create: [
            { name: 'Production' },
            { name: 'Staging' },
          ],
        },
        members: {
          create: [{ userId: req.userId, role: 'owner' }],
        },
      },
      include: { deployments: true },
    });

    await activity.log(app.id, req.userId, 'app.create', { name, platform });
    res.status(201).json(app);
  } catch (err) {
    if (err.code === 'P2002') return res.status(409).json({ error: 'App with this name already exists' });
    res.status(500).json({ error: err.message });
  }
});

// List apps — includes apps where user is member
router.get('/', async (req, res) => {
  try {
    const apps = await prisma.app.findMany({
      where: {
        OR: [
          { userId: req.userId },
          { members: { some: { userId: req.userId } } },
        ],
      },
      include: {
        deployments: { select: { id: true, name: true, deploymentKey: true, _count: { select: { releases: true } } } },
        members: { where: { userId: req.userId }, select: { role: true } },
        _count: { select: { members: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const result = apps.map((app) => ({
      ...app,
      role: app.userId === req.userId ? 'owner' : (app.members[0]?.role || 'viewer'),
    }));

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get single app
router.get('/:id', async (req, res) => {
  try {
    const result = await findAppForUser(req.params.id, req.userId);
    if (!result) return res.status(404).json({ error: 'App not found' });

    const app = await prisma.app.findUnique({
      where: { id: req.params.id },
      include: {
        deployments: {
          include: {
            _count: { select: { releases: true } },
            releases: { where: { isDisabled: false, rolledBackAt: null }, orderBy: { version: 'desc' }, take: 1 },
          },
        },
        _count: { select: { members: true } },
      },
    });

    res.json({ ...app, role: result.role });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Rename app (owner only)
router.patch('/:id', async (req, res) => {
  try {
    const result = await findAppForUser(req.params.id, req.userId);
    if (!result) return res.status(404).json({ error: 'App not found' });
    if (result.role !== 'owner') return res.status(403).json({ error: 'Only owner can rename app' });

    const { name } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'name is required' });

    const updated = await prisma.app.update({
      where: { id: req.params.id },
      data: { name: name.trim() },
    });

    await activity.log(req.params.id, req.userId, 'app.rename', { name: name.trim() });
    res.json(updated);
  } catch (err) {
    if (err.code === 'P2002') return res.status(409).json({ error: 'App with this name already exists' });
    res.status(500).json({ error: err.message });
  }
});

// Delete app (owner only)
router.delete('/:id', async (req, res) => {
  try {
    const result = await findAppForUser(req.params.id, req.userId);
    if (!result) return res.status(404).json({ error: 'App not found' });
    if (result.role !== 'owner') return res.status(403).json({ error: 'Only owner can delete app' });

    const appId = req.params.id;
    // Cascade delete
    const releases = await prisma.release.findMany({ where: { deployment: { appId } }, select: { id: true } });
    const releaseIds = releases.map((r) => r.id);

    await prisma.$transaction([
      prisma.deviceInstall.deleteMany({ where: { releaseId: { in: releaseIds } } }),
      prisma.release.deleteMany({ where: { id: { in: releaseIds } } }),
      prisma.activityLog.deleteMany({ where: { appId } }),
      prisma.appInvite.deleteMany({ where: { appId } }),
      prisma.appMember.deleteMany({ where: { appId } }),
      prisma.deployment.deleteMany({ where: { appId } }),
      prisma.device.deleteMany({ where: { appId } }),
      prisma.deviceGroup.deleteMany({ where: { appId } }),
      prisma.app.delete({ where: { id: appId } }),
    ]);

    res.json({ message: 'App deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
