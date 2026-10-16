import redisClient from './src/config/redis.js';

async function clearCache() {
    try {
        await redisClient.connect();
        const client = redisClient.getClient();
        const keys = await client.keys('*pm_*');
        console.log(`Found ${keys.length} keys`);
        if (keys.length > 0) {
            const num = await client.del(keys);
            console.log(`Deleted ${num} keys`);
        }
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

clearCache();
