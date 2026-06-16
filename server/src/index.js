require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const { ensureDir } = require('./services/storage');

const { PrismaClient } = require('@prisma/client');

const authRoutes = require('./routes/auth');
const appRoutes = require('./routes/apps');
const releaseRoutes = require('./routes/releases');
const updateRoutes = require('./routes/update');
const deploymentRoutes = require('./routes/deployments');
const memberRoutes = require('./routes/members');
const activityRoutes = require('./routes/activity');
const deviceRoutes = require('./routes/devices');
const deviceGroupRoutes = require('./routes/device-groups');

const app = express();
const PORT = process.env.PORT || 3000;

ensureDir(process.env.UPLOAD_DIR || './uploads');

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'fastpush', version: '1.0.0' });
});

app.use('/api/auth', authRoutes);
app.use('/api/apps', appRoutes);
app.use('/api/apps', releaseRoutes);
app.use('/api/apps/:appId/deployments', deploymentRoutes);
app.use('/api/apps/:appId/members', memberRoutes);
app.use('/api/apps/:appId/activity', activityRoutes);
app.use('/api/apps/:appId/devices', deviceRoutes);
app.use('/api/apps/:appId/device-groups', deviceGroupRoutes);
app.use('/api/update', updateRoutes);

// Accept invite via token link
app.get('/api/invites/:token/accept', async (req, res) => {
  const prisma = new PrismaClient();
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Login required to accept invite' });

    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(authHeader.replace('Bearer ', ''), process.env.JWT_SECRET);
    const userId = decoded.userId;

    const invite = await prisma.appInvite.findUnique({ where: { token: req.params.token } });
    if (!invite) return res.status(404).json({ error: 'Invalid or expired invite' });
    if (invite.accepted) return res.status(400).json({ error: 'Invite already accepted' });

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (user.email !== invite.email) return res.status(403).json({ error: 'This invite is for a different email address' });

    await prisma.$transaction([
      prisma.appMember.upsert({
        where: { appId_userId: { appId: invite.appId, userId } },
        create: { appId: invite.appId, userId, role: invite.role },
        update: { role: invite.role },
      }),
      prisma.appInvite.update({ where: { id: invite.id }, data: { accepted: true } }),
    ]);

    res.json({ message: 'You have joined the team!', appId: invite.appId, role: invite.role });
  } catch (err) {
    if (err.name === 'JsonWebTokenError') return res.status(401).json({ error: 'Invalid token' });
    res.status(500).json({ error: err.message });
  } finally {
    await prisma.$disconnect();
  }
});

app.use((err, req, res, _next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`FastPush server running on port ${PORT}`);
});
