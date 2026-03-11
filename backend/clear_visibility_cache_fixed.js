
import redisClient from './src/config/redis.js';

async function clearCache() {
    try {
        console.log('--- Clearing Visibility Cache ---');
        await redisClient.connect();
        const client = redisClient.getClient();
        if (!client) {
            console.log('Redis client not available');
            process.exit(0);
        }
        const keys = await client.keys('watchtower:*visibility*');
        console.log(`Found ${keys.length} visibility keys`);
        if (keys.length > 0) {
            await client.del(keys);
            console.log('Deleted keys:', keys);
        }
        console.log('Cache cleared successfully');
        await redisClient.disconnect();
        process.exit(0);
    } catch (err) {
        console.error('Error clearing cache:', err);
        process.exit(1);
    }
}

clearCache();
