require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const { ensureDir } = require('./services/storage');

const authRoutes = require('./routes/auth');
const appRoutes = require('./routes/apps');
const releaseRoutes = require('./routes/releases');
const updateRoutes = require('./routes/update');

const app = express();
const PORT = process.env.PORT || 3000;

ensureDir(process.env.UPLOAD_DIR || './uploads');

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'fastpush', version: '1.0.0' });
});

app.use('/api/auth', authRoutes);
app.use('/api/apps', appRoutes);
app.use('/api/apps', releaseRoutes);
app.use('/api/update', updateRoutes);

app.use((err, req, res, _next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`FastPush server running on port ${PORT}`);
});
