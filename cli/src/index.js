#!/usr/bin/env node

const { Command } = require('commander');
const { login, register, setServer } = require('./commands/login');
const { createApp, listApps, appInfo } = require('./commands/app');
const { release } = require('./commands/release');
const { history } = require('./commands/history');
const { rollback, promote, metrics } = require('./commands/rollback');

const program = new Command();

program
  .name('fastpush')
  .description('FastPush — OTA update tool for React Native')
  .version('1.0.0');

program
  .command('login')
  .description('Login to FastPush server')
  .option('-e, --email <email>', 'Account email')
  .option('-p, --password <password>', 'Account password')
  .action(login);

program
  .command('register')
  .description('Create a new account')
  .option('-n, --name <name>', 'Your name')
  .option('-e, --email <email>', 'Account email')
  .option('-p, --password <password>', 'Account password')
  .action(register);

program
  .command('server <url>')
  .description('Set server URL (default: http://localhost:3000)')
  .action(setServer);

const appCmd = program.command('app').description('Manage apps');

appCmd
  .command('create <name>')
  .description('Create a new app')
  .option('--platform <platform>', 'Platform: android or ios', 'android')
  .action(createApp);

appCmd
  .command('list')
  .description('List all apps')
  .action(listApps);

appCmd
  .command('info <appId>')
  .description('Show app details')
  .action(appInfo);

program
  .command('release')
  .description('Build and push a new release')
  .requiredOption('--app <name>', 'App name')
  .requiredOption('--target-version <version>', 'Target native app version (e.g., "1.0.0" or "1.0.x")')
  .option('--entry-file <file>', 'Entry file', 'index.js')
  .option('--platform <platform>', 'Platform', 'android')
  .option('--description <desc>', 'Release description')
  .option('--mandatory', 'Mark as mandatory update', false)
  .option('--type <type>', 'Release type: bundle or apk', 'bundle')
  .option('--file <path>', 'Upload pre-built file instead of building')
  .action(release);

program
  .command('history')
  .description('View release history')
  .requiredOption('--app <name>', 'App name')
  .action(history);

program
  .command('rollback')
  .description('Rollback to the previous active release')
  .requiredOption('--app <name>', 'App name')
  .action(rollback);

program
  .command('promote')
  .description('Update rollout percentage of a release')
  .requiredOption('--app <name>', 'App name')
  .requiredOption('--version <number>', 'Release version number')
  .option('--rollout <percent>', 'Rollout percentage (0-100)', '100')
  .action(promote);

program
  .command('metrics')
  .description('View download/install metrics')
  .requiredOption('--app <name>', 'App name')
  .action(metrics);

program.parse();
