import redisClient from './src/config/redis.js';

async function clearCache() {
    try {
        await redisClient.connect();
        const client = redisClient.getClient();
        if (client) {
            await client.flushAll();
            console.log("✅ Redis cache flushed completely!");
        } else {
            console.log("⚠️ Redis not connected or disabled.");
        }
        process.exit(0);
    } catch (e) {
        console.error("❌ Error flushing cache:", e);
        process.exit(1);
    }
}

clearCache();
