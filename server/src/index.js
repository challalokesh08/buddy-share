'use strict';

const os = require('node:os');
const express = require('express');
const cors = require('cors');
const { PORT } = require('./config');
const routes = require('./routes');
const rt = require('./realtime');

const app = express();
app.use(cors());
app.use(express.json({ limit: '256kb' }));
app.use('/api', routes);
app.use((err, _req, res, _next) => {
  console.error('[server]', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n  Buddy Share API  →  http://localhost:${PORT}`);
  for (const [name, addrs] of Object.entries(os.networkInterfaces())) {
    for (const addr of addrs || []) {
      if (addr.family === 'IPv4' && !addr.internal) {
        console.log(`  On your Android phone  →  http://${addr.address}:${PORT}`);
      }
    }
  }
  console.log(`  College domains        →  ${require('./config').COLLEGE_DOMAINS.join(', ')}\n`);
});

rt.attach(server);

function shutdown() {
  console.log('\n  Shutting down...');
  require('./store').persistSync();
  server.close(() => process.exit(0));
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
