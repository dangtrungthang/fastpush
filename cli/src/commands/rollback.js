const { request } = require('../utils/api');

async function rollback(options) {
  const { app: appName } = options;
  if (!appName) { console.error('✗ --app is required'); process.exit(1); }

  try {
    const apps = await request('GET', '/apps');
    const app = apps.find((a) => a.name === appName);
    if (!app) { console.error(`✗ App "${appName}" not found`); process.exit(1); }

    const result = await request('POST', `/apps/${app.id}/rollback`);
    console.log(`✓ ${result.message}`);
  } catch (err) {
    console.error(`✗ Rollback failed: ${err.message}`);
    process.exit(1);
  }
}

async function promote(options) {
  const { app: appName, version, rollout } = options;
  if (!appName || !version) { console.error('✗ --app and --version are required'); process.exit(1); }

  try {
    const apps = await request('GET', '/apps');
    const app = apps.find((a) => a.name === appName);
    if (!app) { console.error(`✗ App "${appName}" not found`); process.exit(1); }

    const releases = await request('GET', `/apps/${app.id}/releases`);
    const release = releases.find((r) => String(r.version) === String(version));
    if (!release) { console.error(`✗ Release v${version} not found`); process.exit(1); }

    const newPercent = parseInt(rollout) || 100;
    const updated = await request('PATCH', `/apps/${app.id}/releases/${release.id}/rollout`, { rolloutPercent: newPercent });
    console.log(`✓ Release v${updated.version} rollout updated to ${updated.rolloutPercent}%`);
  } catch (err) {
    console.error(`✗ Promote failed: ${err.message}`);
    process.exit(1);
  }
}

async function metrics(options) {
  const { app: appName } = options;
  if (!appName) { console.error('✗ --app is required'); process.exit(1); }

  try {
    const apps = await request('GET', '/apps');
    const app = apps.find((a) => a.name === appName);
    if (!app) { console.error(`✗ App "${appName}" not found`); process.exit(1); }

    const releases = await request('GET', `/apps/${app.id}/releases`);
    const activeReleases = releases.filter((r) => !r.isDisabled && !r.rolledBackAt).slice(0, 5);

    if (activeReleases.length === 0) { console.log('No active releases.'); return; }

    console.log(`\nMetrics for "${appName}":\n`);
    console.log('  Ver  Rollout  Downloads  Installs  Failures  Install Rate');
    console.log('  ---  -------  ---------  --------  --------  ------------');

    for (const r of activeReleases) {
      const rate = r.downloadCount > 0 ? `${Math.round((r.installCount / r.downloadCount) * 100)}%` : 'N/A';
      console.log(
        `  ${String(r.version).padEnd(4)} ${String(r.rolloutPercent + '%').padEnd(8)} ` +
        `${String(r.downloadCount).padEnd(10)} ${String(r.installCount).padEnd(9)} ` +
        `${String(r.failCount).padEnd(9)} ${rate}`
      );
    }
    console.log('');
  } catch (err) {
    console.error(`✗ Failed: ${err.message}`);
    process.exit(1);
  }
}

module.exports = { rollback, promote, metrics };
