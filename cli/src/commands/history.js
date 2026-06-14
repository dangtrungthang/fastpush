const { request } = require('../utils/api');

async function history(options) {
  const { app: appName } = options;

  if (!appName) {
    console.error('✗ --app is required');
    process.exit(1);
  }

  try {
    const apps = await request('GET', '/apps');
    const app = apps.find((a) => a.name === appName);
    if (!app) {
      console.error(`✗ App "${appName}" not found`);
      process.exit(1);
    }

    const releases = await request('GET', `/apps/${app.id}/releases`);

    if (releases.length === 0) {
      console.log(`No releases for "${appName}".`);
      return;
    }

    console.log(`\nReleases for "${appName}" (${releases.length}):\n`);
    console.log('  Ver  Type     Target     Size       Downloads  Mandatory  Status     Date');
    console.log('  ---  -------  ---------  ---------  ---------  ---------  ---------  ----------');

    for (const r of releases) {
      const size = `${(r.fileSize / 1024).toFixed(1)}KB`;
      const status = r.isDisabled ? 'disabled' : 'active';
      const date = new Date(r.createdAt).toISOString().slice(0, 10);
      const mandatory = r.isMandatory ? 'yes' : 'no';
      console.log(
        `  ${String(r.version).padEnd(4)} ${r.type.padEnd(8)} ${r.targetVersion.padEnd(10)} ${size.padEnd(10)} ${String(r.downloadCount).padEnd(10)} ${mandatory.padEnd(10)} ${status.padEnd(10)} ${date}`
      );
    }
    console.log('');
  } catch (err) {
    console.error(`✗ Failed: ${err.message}`);
    process.exit(1);
  }
}

module.exports = { history };
