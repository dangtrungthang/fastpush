const { Router } = require('express');
const { PrismaClient } = require('@prisma/client');
const auth = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const activity = require('../services/activity');

const router = Router({ mergeParams: true });
const prisma = new PrismaClient();

router.use(auth);

// GET /api/apps/:appId/devices
router.get('/', requireRole('viewer'), async (req, res) => {
  try {
    const devices = await prisma.device.findMany({
      where: { appId: req.params.appId },
      include: { deviceGroup: { select: { id: true, name: true } } },
      orderBy: { lastSeenAt: 'desc' },
    });
    res.json(devices);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/apps/:appId/devices/:deviceId — assign/unassign group
router.patch('/:deviceId', requireRole('collaborator'), async (req, res) => {
  try {
    const { deviceGroupId } = req.body;

    const device = await prisma.device.findFirst({
      where: { id: req.params.deviceId, appId: req.params.appId },
    });
    if (!device) return res.status(404).json({ error: 'Device not found' });

    if (deviceGroupId) {
      const group = await prisma.deviceGroup.findFirst({
        where: { id: deviceGroupId, appId: req.params.appId },
      });
      if (!group) return res.status(404).json({ error: 'Device group not found' });
    }

    const updated = await prisma.device.update({
      where: { id: device.id },
      data: { deviceGroupId: deviceGroupId || null },
      include: { deviceGroup: { select: { id: true, name: true } } },
    });

    await activity.log(req.params.appId, req.userId, 'device.group_change', { serialNumber: device.serialNumber, deviceGroupId: deviceGroupId || null });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/apps/:appId/devices/:deviceId
router.delete('/:deviceId', requireRole('collaborator'), async (req, res) => {
  try {
    const device = await prisma.device.findFirst({
      where: { id: req.params.deviceId, appId: req.params.appId },
    });
    if (!device) return res.status(404).json({ error: 'Device not found' });

    await prisma.device.delete({ where: { id: device.id } });
    await activity.log(req.params.appId, req.userId, 'device.delete', { serialNumber: device.serialNumber });
    res.json({ message: 'Device deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
