const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Find app where user is owner OR member
async function findAppForUser(appId, userId) {
  const app = await prisma.app.findFirst({
    where: {
      id: appId,
      OR: [
        { userId },
        { members: { some: { userId } } },
      ],
    },
    include: {
      members: { where: { userId }, select: { role: true } },
    },
  });
  if (!app) return null;

  const isOwner = app.userId === userId;
  const role = isOwner ? 'owner' : (app.members[0]?.role || null);
  return { app, role };
}

// Middleware factory: require minimum role level
// owner > collaborator > viewer
const ROLE_LEVELS = { owner: 3, collaborator: 2, viewer: 1 };

function requireRole(minRole) {
  return async (req, res, next) => {
    const appId = req.params.appId || req.params.id;
    if (!appId) return next(); // no app context

    const result = await findAppForUser(appId, req.userId);
    if (!result) return res.status(404).json({ error: 'App not found' });

    req.app = result.app;
    req.userRole = result.role;

    if ((ROLE_LEVELS[result.role] || 0) < (ROLE_LEVELS[minRole] || 0)) {
      return res.status(403).json({ error: `Requires ${minRole} role` });
    }
    next();
  };
}

module.exports = { requireRole, findAppForUser };
