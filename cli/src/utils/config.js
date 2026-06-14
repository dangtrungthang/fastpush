const fs = require('fs');
const path = require('path');
const os = require('os');

const CONFIG_DIR = path.join(os.homedir(), '.fastpush');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

function ensureConfigDir() {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

function readConfig() {
  ensureConfigDir();
  if (!fs.existsSync(CONFIG_FILE)) return {};
  return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
}

function writeConfig(data) {
  ensureConfigDir();
  const existing = readConfig();
  fs.writeFileSync(CONFIG_FILE, JSON.stringify({ ...existing, ...data }, null, 2));
}

function getToken() {
  const config = readConfig();
  return config.token;
}

function getServerUrl() {
  const config = readConfig();
  return config.serverUrl || 'http://localhost:3000';
}

module.exports = { readConfig, writeConfig, getToken, getServerUrl };
