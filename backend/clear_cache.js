
import redisClient from './src/config/redis.js';

async function clearCache() {
    try {
        console.log("Connecting to Redis...");
        await redisClient.connect();
        const client = redisClient.getClient();
        if (client) {
            console.log("Connected. Flushing all keys...");
            await client.flushAll();
            console.log("✅ Cache cleared successfully.");
        } else {
            console.log("❌ Redis client not available.");
        }
        await redisClient.disconnect();
    } catch (e) {
        console.error("❌ Failed to clear cache:", e);
    }
}

clearCache();
