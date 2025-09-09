const Redis = require('ioredis');
const logger = require('./config/logger');

const redisConfig = {
  url: process.env.REDIS_URL || 'redis://localhost:6379',
  retryStrategy(times) {
    const delay = Math.min(times * 50, 2000); // Exponential backoff, max 2 seconds
    logger.info(`Retrying Redis connection attempt ${times}, delay: ${delay}ms`);
    return delay;
  },
  maxRetriesPerRequest: 3,
  connectTimeout: 10000,
  enableOfflineQueue: true,
  lazyConnect: true,
  // Redis Cloud free plan has a 30-connection limit
  maxConnections: 30,
};

const redisClient = new Redis(redisConfig.url, {
  ...redisConfig,
  // Explicitly disable TLS since rediss:// doesn't work
  tls: undefined,
});

redisClient.on('connect', () => {
  logger.info('Redis connected successfully');
});

redisClient.on('ready', () => {
  logger.info('Redis is ready');
});

redisClient.on('error', (error) => {
  logger.error(`Redis error: ${error.message}`);
});

redisClient.on('close', () => {
  logger.warn('Redis connection closed');
});

redisClient.on('end', () => {
  logger.warn('Redis connection ended');
});

// Connect explicitly
redisClient.connect().catch((err) => {
  logger.error(`Failed to connect to Redis: ${err.message}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  redisClient.quit(() => {
    logger.info('Redis connection closed gracefully');
    process.exit(0);
  });
});

module.exports = redisClient;