import 'dotenv/config';
import redisClient from './src/config/redis.js';

async function flush() {
    try {
        await redisClient.connect();

        if (redisClient.isReady()) {
            const client = redisClient.getClient();

            // Find all pricing_ecp_by_city cache keys
            const keys = await client.keys('*pricing_ecp_by_city*');
            console.log('Found', keys.length, 'pricing_ecp_by_city cache keys');

            for (const key of keys) {
                await client.del(key);
                console.log('Deleted:', key);
            }

            console.log('Done! Stale cache cleared.');
            await redisClient.disconnect();
        } else {
            console.log('Redis not ready');
        }
    } catch (e) {
        console.error('Error:', e.message);
    }
    process.exit(0);
}

flush();
