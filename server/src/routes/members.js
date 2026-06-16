const { Router } = require('express');
const { PrismaClient } = require('@prisma/client');
const auth = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const activity = require('../services/activity');

const router = Router({ mergeParams: true });
const prisma = new PrismaClient();

router.use(auth);

// GET /api/apps/:appId/members
router.get('/', requireRole('viewer'), async (req, res) => {
  try {
    const [members, invites] = await Promise.all([
      prisma.appMember.findMany({
        where: { appId: req.params.appId },
        include: { user: { select: { id: true, email: true, name: true } } },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.appInvite.findMany({
        where: { appId: req.params.appId, accepted: false },
        select: { id: true, email: true, role: true, token: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
      }),
    ]);
    res.json({ members, invites });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/apps/:appId/members/invite
router.post('/invite', requireRole('owner'), async (req, res) => {
  try {
    const { email, role = 'collaborator' } = req.body;
    if (!email) return res.status(400).json({ error: 'email is required' });
    if (!['collaborator', 'viewer'].includes(role)) return res.status(400).json({ error: 'role must be collaborator or viewer' });

    // Check if user is already a member
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      const existing = await prisma.appMember.findUnique({
        where: { appId_userId: { appId: req.params.appId, userId: existingUser.id } },
      });
      if (existing) return res.status(409).json({ error: 'User is already a member' });
    }

    const invite = await prisma.appInvite.upsert({
      where: { appId_email: { appId: req.params.appId, email } },
      create: { appId: req.params.appId, email, role },
      update: { role, accepted: false },
    });

    await activity.log(req.params.appId, req.userId, 'member.invite', { email, role });

    // In production you'd send an email with the invite link
    // For now return the token so it can be shown/copied in the UI
    res.status(201).json({
      ...invite,
      inviteLink: `/invites/${invite.token}/accept`,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/invites/:token/accept  (mounted at root level in index.js)
// This is handled via a separate route — see index.js

// PATCH /api/apps/:appId/members/:userId — change role
router.patch('/:userId', requireRole('owner'), async (req, res) => {
  try {
    const { role } = req.body;
    if (!['collaborator', 'viewer'].includes(role)) return res.status(400).json({ error: 'role must be collaborator or viewer' });

    const member = await prisma.appMember.findUnique({
      where: { appId_userId: { appId: req.params.appId, userId: req.params.userId } },
    });
    if (!member) return res.status(404).json({ error: 'Member not found' });
    if (member.role === 'owner') return res.status(400).json({ error: 'Cannot change owner role' });

    const updated = await prisma.appMember.update({
      where: { appId_userId: { appId: req.params.appId, userId: req.params.userId } },
      data: { role },
      include: { user: { select: { email: true, name: true } } },
    });

    await activity.log(req.params.appId, req.userId, 'member.role_change', { email: updated.user.email, role });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/apps/:appId/members/:userId
router.delete('/:userId', requireRole('owner'), async (req, res) => {
  try {
    const member = await prisma.appMember.findUnique({
      where: { appId_userId: { appId: req.params.appId, userId: req.params.userId } },
      include: { user: { select: { email: true } } },
    });
    if (!member) return res.status(404).json({ error: 'Member not found' });
    if (member.role === 'owner') return res.status(400).json({ error: 'Cannot remove owner' });

    await prisma.appMember.delete({
      where: { appId_userId: { appId: req.params.appId, userId: req.params.userId } },
    });

    await activity.log(req.params.appId, req.userId, 'member.remove', { email: member.user.email });
    res.json({ message: 'Member removed' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/apps/:appId/members/invites/:id — cancel invite
router.delete('/invites/:id', requireRole('owner'), async (req, res) => {
  try {
    const invite = await prisma.appInvite.findFirst({
      where: { id: req.params.id, appId: req.params.appId },
    });
    if (!invite) return res.status(404).json({ error: 'Invite not found' });

    await prisma.appInvite.delete({ where: { id: req.params.id } });
    res.json({ message: 'Invite cancelled' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
