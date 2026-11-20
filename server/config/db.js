import mongoose from 'mongoose';
import logger from '../utils/logger.js';

const SERVER_SELECTION_TIMEOUT_MS = 10000;
const CONNECTED = 1;

let listenersAttached = false;

const attachConnectionListeners = () => {
  if (listenersAttached) return;
  listenersAttached = true;

  const { connection } = mongoose;
  connection.on('connected', () => logger.info('MongoDB connected'));
  connection.on('disconnected', () => logger.warn('MongoDB disconnected'));
  connection.on('reconnected', () => logger.info('MongoDB reconnected'));
  // Log only the message: driver errors can include host names from the connection string.
  connection.on('error', (err) => logger.error('MongoDB connection error', { reason: err.message }));
};

export const connectDB = async (uri) => {
  attachConnectionListeners();
  await mongoose.connect(uri, { serverSelectionTimeoutMS: SERVER_SELECTION_TIMEOUT_MS });
};

export const disconnectDB = async () => {
  if (mongoose.connection.readyState === 0) return;
  await mongoose.disconnect();
  logger.info('MongoDB connection closed');
};

/** @returns {'connected' | 'disconnected'} */
export const getDbStatus = () => (mongoose.connection.readyState === CONNECTED ? 'connected' : 'disconnected');

/**
 * Close the HTTP server and the MongoDB connection cleanly on SIGINT/SIGTERM.
 * @param {import('node:http').Server} httpServer
 */
export const registerGracefulShutdown = (httpServer) => {
  const FORCE_EXIT_AFTER_MS = 10000;
  let shuttingDown = false;

  const shutdown = async (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info('Shutdown signal received', { signal });

    // Safety net in case open connections keep the server from closing.
    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, FORCE_EXIT_AFTER_MS).unref();

    try {
      await new Promise((resolve) => httpServer.close(resolve));
      await disconnectDB();
      process.exit(0);
    } catch (err) {
      logger.error('Error during shutdown', { error: err });
      process.exit(1);
    }
  };

  process.once('SIGINT', () => shutdown('SIGINT'));
  process.once('SIGTERM', () => shutdown('SIGTERM'));
};

