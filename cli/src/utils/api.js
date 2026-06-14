const fetch = require('node-fetch');
const FormData = require('form-data');
const fs = require('fs');
const { getToken, getServerUrl } = require('./config');

async function request(method, endpoint, body = null) {
  const url = `${getServerUrl()}/api${endpoint}`;
  const headers = { 'Content-Type': 'application/json' };

  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const options = { method, headers };
  if (body) options.body = JSON.stringify(body);

  const res = await fetch(url, options);
  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || `Request failed with status ${res.status}`);
  }
  return data;
}

async function uploadFile(endpoint, filePath, fields = {}) {
  const url = `${getServerUrl()}/api${endpoint}`;
  const form = new FormData();

  form.append('file', fs.createReadStream(filePath));
  for (const [key, value] of Object.entries(fields)) {
    form.append(key, String(value));
  }

  const headers = { ...form.getHeaders() };
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(url, { method: 'POST', headers, body: form });
  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || `Upload failed with status ${res.status}`);
  }
  return data;
}

module.exports = { request, uploadFile };
