const { request } = require('../utils/api');

async function createApp(name, options) {
  const platform = options.platform || 'android';
  try {
    const app = await request('POST', '/apps', { name, platform });
    console.log(`✓ App "${app.name}" created (${app.platform})`);
    console.log(`  Deployment Key: ${app.deploymentKey}`);
    console.log(`  App ID: ${app.id}`);
  } catch (err) {
    console.error(`✗ Failed: ${err.message}`);
    process.exit(1);
  }
}

async function listApps() {
  try {
    const apps = await request('GET', '/apps');
    if (apps.length === 0) {
      console.log('No apps found. Create one with: fastpush app create <name>');
      return;
    }
    console.log(`\nYour apps (${apps.length}):\n`);
    for (const app of apps) {
      const count = app._count?.releases || 0;
      console.log(`  ${app.name} (${app.platform}) — ${count} releases`);
      console.log(`    Key: ${app.deploymentKey}`);
      console.log(`    ID:  ${app.id}\n`);
    }
  } catch (err) {
    console.error(`✗ Failed: ${err.message}`);
    process.exit(1);
  }
}

async function appInfo(appId) {
  try {
    const app = await request('GET', `/apps/${appId}`);
    console.log(`\n  Name:           ${app.name}`);
    console.log(`  Platform:       ${app.platform}`);
    console.log(`  Deployment Key: ${app.deploymentKey}`);
    console.log(`  Releases:       ${app._count?.releases || 0}`);
    console.log(`  Created:        ${app.createdAt}\n`);
  } catch (err) {
    console.error(`✗ Failed: ${err.message}`);
    process.exit(1);
  }
}

module.exports = { createApp, listApps, appInfo };
