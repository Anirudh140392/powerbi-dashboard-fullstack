import redisClient from './src/config/redis.js';

async function clearCache() {
    await redisClient.connect();
    if (redisClient.isReady()) {
        await redisClient.getClient().flushAll();
        console.log("Redis cache flushed successfully.");
    } else {
        console.log("Redis is not ready/enabled.");
    }
    await redisClient.disconnect();
    process.exit(0);
}

clearCache();
