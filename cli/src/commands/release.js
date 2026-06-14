const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');
const archiver = require('archiver');
const { uploadFile, request } = require('../utils/api');

async function findAppByName(appName) {
  const apps = await request('GET', '/apps');
  const app = apps.find((a) => a.name === appName);
  if (!app) throw new Error(`App "${appName}" not found. Run "fastpush app list" to see your apps.`);
  return app;
}

function buildBundle(entryFile, platform, outputDir) {
  const bundleFile = path.join(outputDir, 'index.bundle');
  const assetsDir = path.join(outputDir, 'assets');

  fs.mkdirSync(outputDir, { recursive: true });
  fs.mkdirSync(assetsDir, { recursive: true });

  const cmd = `npx react-native bundle --platform ${platform} --entry-file ${entryFile} --bundle-output ${bundleFile} --assets-dest ${assetsDir} --dev false`;

  console.log('Building bundle...');
  execSync(cmd, { stdio: 'inherit' });

  return outputDir;
}

function zipDirectory(sourceDir, outputPath) {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(outputPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', () => resolve(outputPath));
    archive.on('error', reject);

    archive.pipe(output);
    archive.directory(sourceDir, false);
    archive.finalize();
  });
}

async function release(options) {
  const {
    app: appName,
    entryFile = 'index.js',
    platform = 'android',
    targetVersion,
    description,
    mandatory = false,
    type = 'bundle',
    file,
  } = options;

  if (!appName) {
    console.error('✗ --app is required');
    process.exit(1);
  }
  if (!targetVersion) {
    console.error('✗ --target-version is required (e.g., "1.0.0" or "1.0.x")');
    process.exit(1);
  }

  try {
    const app = await findAppByName(appName);
    let uploadPath;

    if (file) {
      if (!fs.existsSync(file)) {
        console.error(`✗ File not found: ${file}`);
        process.exit(1);
      }
      uploadPath = file;
    } else {
      const outputDir = path.join(process.cwd(), '.fastpush', 'build');
      const zipPath = path.join(process.cwd(), '.fastpush', 'bundle.zip');

      buildBundle(entryFile, platform, outputDir);
      console.log('Compressing bundle...');
      await zipDirectory(outputDir, zipPath);
      uploadPath = zipPath;
    }

    console.log('Uploading to server...');
    const result = await uploadFile(`/apps/${app.id}/releases`, uploadPath, {
      targetVersion,
      type,
      description: description || '',
      isMandatory: mandatory,
    });

    console.log(`\n✓ Release v${result.version} published!`);
    console.log(`  Type:    ${result.type}`);
    console.log(`  Target:  ${result.targetVersion}`);
    console.log(`  Size:    ${(result.fileSize / 1024).toFixed(1)} KB`);
    console.log(`  Hash:    ${result.hash.slice(0, 16)}...`);
  } catch (err) {
    console.error(`✗ Release failed: ${err.message}`);
    process.exit(1);
  }
}

module.exports = { release };
