const { Router } = require('express');
const { PrismaClient } = require('@prisma/client');
const auth = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const activity = require('../services/activity');

const router = Router({ mergeParams: true });
const prisma = new PrismaClient();

router.use(auth);

// GET /api/apps/:appId/device-groups
router.get('/', requireRole('viewer'), async (req, res) => {
  try {
    const groups = await prisma.deviceGroup.findMany({
      where: { appId: req.params.appId },
      include: { _count: { select: { devices: true } } },
      orderBy: { createdAt: 'asc' },
    });
    res.json(groups);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/apps/:appId/device-groups
router.post('/', requireRole('collaborator'), async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });

    const group = await prisma.deviceGroup.create({
      data: { appId: req.params.appId, name },
    });

    await activity.log(req.params.appId, req.userId, 'device_group.create', { name });
    res.status(201).json(group);
  } catch (err) {
    if (err.code === 'P2002') return res.status(409).json({ error: 'Device group with this name already exists' });
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/apps/:appId/device-groups/:id — rename
router.patch('/:id', requireRole('collaborator'), async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });

    const group = await prisma.deviceGroup.findFirst({
      where: { id: req.params.id, appId: req.params.appId },
    });
    if (!group) return res.status(404).json({ error: 'Device group not found' });

    const updated = await prisma.deviceGroup.update({
      where: { id: group.id },
      data: { name },
    });

    await activity.log(req.params.appId, req.userId, 'device_group.rename', { from: group.name, to: name });
    res.json(updated);
  } catch (err) {
    if (err.code === 'P2002') return res.status(409).json({ error: 'Device group with this name already exists' });
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/apps/:appId/device-groups/:id
router.delete('/:id', requireRole('collaborator'), async (req, res) => {
  try {
    const group = await prisma.deviceGroup.findFirst({
      where: { id: req.params.id, appId: req.params.appId },
    });
    if (!group) return res.status(404).json({ error: 'Device group not found' });

    await prisma.deviceGroup.delete({ where: { id: group.id } });
    await activity.log(req.params.appId, req.userId, 'device_group.delete', { name: group.name });
    res.json({ message: 'Device group deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
