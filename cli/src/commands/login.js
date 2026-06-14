const inquirer = require('inquirer');
const { request } = require('../utils/api');
const { writeConfig } = require('../utils/config');

async function login(options) {
  let email = options.email;
  let password = options.password;

  if (!email || !password) {
    const answers = await inquirer.prompt([
      ...(!email ? [{ type: 'input', name: 'email', message: 'Email:' }] : []),
      ...(!password ? [{ type: 'password', name: 'password', message: 'Password:' }] : []),
    ]);
    email = email || answers.email;
    password = password || answers.password;
  }

  try {
    const data = await request('POST', '/auth/login', { email, password });
    writeConfig({ token: data.token });
    console.log(`✓ Logged in as ${data.user.email}`);
  } catch (err) {
    console.error(`✗ Login failed: ${err.message}`);
    process.exit(1);
  }
}

async function register(options) {
  let { email, password, name } = options;

  if (!email || !password || !name) {
    const answers = await inquirer.prompt([
      ...(!name ? [{ type: 'input', name: 'name', message: 'Name:' }] : []),
      ...(!email ? [{ type: 'input', name: 'email', message: 'Email:' }] : []),
      ...(!password ? [{ type: 'password', name: 'password', message: 'Password:' }] : []),
    ]);
    name = name || answers.name;
    email = email || answers.email;
    password = password || answers.password;
  }

  try {
    await request('POST', '/auth/register', { email, password, name });
    console.log(`✓ Account created. Run "fastpush login" to sign in.`);
  } catch (err) {
    console.error(`✗ Registration failed: ${err.message}`);
    process.exit(1);
  }
}

function setServer(url) {
  writeConfig({ serverUrl: url.replace(/\/$/, '') });
  console.log(`✓ Server URL set to ${url}`);
}

module.exports = { login, register, setServer };
