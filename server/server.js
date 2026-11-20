import app from './app.js';
import env from './config/env.js';
import { connectDB, registerGracefulShutdown } from './config/db.js';
import logger from './utils/logger.js';

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection', { error: reason });
  process.exit(1);
});

const startServer = async () => {
  try {
    await connectDB(env.MONGODB_URI);
  } catch (err) {
    logger.error('Could not connect to MongoDB; shutting down', { reason: err.message });
    process.exit(1);
  }

  const httpServer = app.listen(env.PORT, (err) => {
    if (err) {
      logger.error('HTTP server failed to start', { reason: err.message });
      process.exit(1);
    }
    logger.info('SEOCheck API listening', { port: env.PORT, env: env.NODE_ENV });
  });

  registerGracefulShutdown(httpServer);
};

await startServer();

