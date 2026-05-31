require('dotenv').config();
const { createApp } = require('./app');
const { sequelize } = require('./models');
const jobQueue = require('./services/jobQueue');
const logger = require('./utils/logger');

// Validate required environment variables
const requiredEnvVars = ['DB_HOST', 'DB_NAME', 'DB_USER', 'DB_PASSWORD', 'OPENAI_API_KEY', 'JWT_SECRET', 'JWT_REFRESH_SECRET'];
const missingVars = requiredEnvVars.filter((v) => !process.env[v]);
if (missingVars.length > 0) {
  logger.error(`Missing required environment variables: ${missingVars.join(', ')}`);
  process.exit(1);
}

const PORT = process.env.PORT || 5000;
const app = createApp();

async function start() {
  try {
    await sequelize.authenticate();
    logger.info('Database connected. Run "npm run migrate" to apply migrations.');

    // Start background job queue (non-blocking — falls back to sync if unavailable)
    await jobQueue.start();

    const server = app.listen(PORT, () => {
      logger.info(`Server running on http://localhost:${PORT} [${process.env.NODE_ENV || 'development'}]`);
    });

    // Graceful shutdown
    const shutdown = async (signal) => {
      logger.info(`${signal} received. Shutting down gracefully...`);
      server.close(async () => {
        await jobQueue.stop();
        await sequelize.close();
        logger.info('Server closed.');
        process.exit(0);
      });
      // Force close after 10s
      setTimeout(() => process.exit(1), 10000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (err) {
    logger.error('Failed to start server:', err);
    process.exit(1);
  }
}

// Global handlers for unhandled errors — log and crash intentionally
// so the process manager (PM2, Docker) can restart cleanly.
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection', {
    error: reason instanceof Error ? reason.message : String(reason),
    stack: reason instanceof Error ? reason.stack : undefined,
  });
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', {
    error: error.message,
    stack: error.stack,
  });
  process.exit(1);
});

start();
