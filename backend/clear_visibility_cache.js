
import redisClient from './src/config/redis.js';

async function clearCache() {
    try {
        console.log('--- Clearing Visibility Cache ---');
        const client = redisClient.getClient();
        const keys = await client.keys('watchtower:*visibility*');
        console.log(`Found ${keys.length} visibility keys`);
        if (keys.length > 0) {
            await client.del(keys);
            console.log('Deleted keys:', keys);
        }
        console.log('Cache cleared successfully');
        process.exit(0);
    } catch (err) {
        console.error('Error clearing cache:', err);
        process.exit(1);
    }
}

clearCache();
