const { request } = require('../utils/api');

function targetLabel(r) {
  if (r.targetMode === 'devices') return `${r.targetDeviceIds?.length || 0} devices`;
  if (r.targetMode === 'group') return 'group';
  return 'all';
}

async function history(options) {
  const { app: appName, deployment: deploymentName } = options;

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

    let releases = await request('GET', `/apps/${app.id}/releases`);

    if (deploymentName) {
      releases = releases.filter((r) => r.deployment?.name === deploymentName);
    }

    if (releases.length === 0) {
      console.log(deploymentName
        ? `No releases in deployment "${deploymentName}" for "${appName}".`
        : `No releases for "${appName}".`);
      return;
    }

    // Group releases by deployment name
    const byDeployment = {};
    for (const r of releases) {
      const depName = r.deployment?.name || 'Unassigned';
      (byDeployment[depName] = byDeployment[depName] || []).push(r);
    }

    console.log(`\nReleases for "${appName}" (${releases.length}):`);

    for (const [depName, depReleases] of Object.entries(byDeployment)) {
      console.log(`\n● ${depName} (${depReleases.length})`);
      console.log('  Ver  Type     Target     Size       Rollout  Target     Downloads  Status     Date');
      console.log('  ---  -------  ---------  ---------  -------  ---------  ---------  ---------  ----------');

      for (const r of depReleases) {
        const size = `${(r.fileSize / 1024).toFixed(1)}KB`;
        const status = r.rolledBackAt ? 'rolledback' : r.isDisabled ? 'disabled' : 'active';
        const date = new Date(r.createdAt).toISOString().slice(0, 10);
        const rollout = `${r.rolloutPercent}%`;
        console.log(
          `  ${String(r.version).padEnd(4)} ${r.type.padEnd(8)} ${r.targetVersion.padEnd(10)} ${size.padEnd(10)} ${rollout.padEnd(8)} ${targetLabel(r).padEnd(10)} ${String(r.downloadCount).padEnd(10)} ${status.padEnd(10)} ${date}`
        );
      }
    }
    console.log('');
  } catch (err) {
    console.error(`✗ Failed: ${err.message}`);
    process.exit(1);
  }
}

module.exports = { history };
