const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function log(appId, userId, action, meta = null) {
  try {
    await prisma.activityLog.create({ data: { appId, userId, action, meta } });
  } catch (e) {
    // Non-critical — don't break the main flow
    console.warn('ActivityLog failed:', e.message);
  }
}

module.exports = { log };
