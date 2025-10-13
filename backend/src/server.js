// Clear require cache to force reload of all modules
Object.keys(require.cache).forEach(key => {
  if (key.includes('controllers')) {
    delete require.cache[key];
  }
});

require('dotenv').config();
const app = require('./index');
const logger = require('./utils/logger');
const eventWatcher = require('./workers/eventWatcher');

const PORT = process.env.PORT || 3000;

// Start HTTP server
const server = app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`, {
    env: process.env.NODE_ENV,
    network: process.env.STARKNET_NETWORK
  });
});

// Start event watcher
if (process.env.NODE_ENV !== 'test') {
  eventWatcher.start().catch(err => {
    logger.error('Event watcher failed to start', { error: err.message });
  });
}

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    logger.info('Server closed');
    eventWatcher.stop();
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  server.close(() => {
    logger.info('Server closed');
    eventWatcher.stop();
    process.exit(0);
  });
});

module.exports = server;
