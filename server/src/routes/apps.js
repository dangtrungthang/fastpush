const { Router } = require('express');
const { PrismaClient } = require('@prisma/client');
const auth = require('../middleware/auth');

const router = Router();
const prisma = new PrismaClient();

router.use(auth);

router.post('/', async (req, res) => {
  try {
    const { name, platform } = req.body;
    if (!name || !platform) {
      return res.status(400).json({ error: 'name and platform are required' });
    }
    if (!['android', 'ios'].includes(platform)) {
      return res.status(400).json({ error: 'platform must be android or ios' });
    }

    const app = await prisma.app.create({
      data: { name, platform, userId: req.userId },
    });

    res.status(201).json(app);
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'App with this name already exists' });
    }
    res.status(500).json({ error: err.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const apps = await prisma.app.findMany({
      where: { userId: req.userId },
      include: { _count: { select: { releases: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json(apps);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const app = await prisma.app.findFirst({
      where: { id: req.params.id, userId: req.userId },
      include: { _count: { select: { releases: true } } },
    });
    if (!app) return res.status(404).json({ error: 'App not found' });
    res.json(app);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const app = await prisma.app.findFirst({
      where: { id: req.params.id, userId: req.userId },
    });
    if (!app) return res.status(404).json({ error: 'App not found' });

    await prisma.release.deleteMany({ where: { appId: app.id } });
    await prisma.app.delete({ where: { id: app.id } });

    res.json({ message: 'App deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
