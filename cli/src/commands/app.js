const { request } = require('../utils/api');

async function createApp(name, options) {
  const platform = options.platform || 'android';
  try {
    const app = await request('POST', '/apps', { name, platform });
    console.log(`✓ App "${app.name}" created (${app.platform})`);
    console.log(`  App ID: ${app.id}`);
    for (const dep of app.deployments || []) {
      console.log(`  ${dep.name} key: ${dep.deploymentKey}`);
    }
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
      const count = app.deployments?.reduce((sum, d) => sum + (d._count?.releases || 0), 0) || 0;
      console.log(`  ${app.name} (${app.platform}) — ${count} releases`);
      for (const dep of app.deployments || []) {
        console.log(`    ${dep.name} key: ${dep.deploymentKey}`);
      }
      console.log(`    ID: ${app.id}\n`);
    }
  } catch (err) {
    console.error(`✗ Failed: ${err.message}`);
    process.exit(1);
  }
}

async function appInfo(appId) {
  try {
    const app = await request('GET', `/apps/${appId}`);
    console.log(`\n  Name:     ${app.name}`);
    console.log(`  Platform: ${app.platform}`);
    console.log(`  Created:  ${app.createdAt}`);
    console.log(`  Deployments:`);
    for (const dep of app.deployments || []) {
      console.log(`    ${dep.name}`);
      console.log(`      Key:      ${dep.deploymentKey}`);
      console.log(`      Releases: ${dep._count?.releases || 0}`);
    }
    console.log('');
  } catch (err) {
    console.error(`✗ Failed: ${err.message}`);
    process.exit(1);
  }
}

module.exports = { createApp, listApps, appInfo };
