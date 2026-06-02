// Server entry: starts the HTTP listener and handles graceful shutdown.

import { app } from './src/app.js';
import { env } from './src/config/env.js';

const server = app.listen(env.PORT, () => {
  console.log(`[inspirare-backend] listening on http://localhost:${env.PORT}  (${env.NODE_ENV})`);
});

function shutdown(signal) {
  console.log(`[inspirare-backend] ${signal} received, closing...`);
  server.close((err) => {
    if (err) {
      console.error('[inspirare-backend] error during shutdown:', err);
      process.exit(1);
    }
    process.exit(0);
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
