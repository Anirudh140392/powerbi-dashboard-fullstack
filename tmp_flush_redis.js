const redis = require('redis');

async function flushCache() {
    const client = redis.createClient({
        url: process.env.REDIS_URL || 'redis://localhost:6379'
    });

    client.on('error', (err) => console.log('Redis Client Error', err));

    await client.connect();
    
    // Find all watchtower keys from performance marketing
    const keys = await client.keys('*pm_campaign_quadrants*');
    console.log(`Found ${keys.length} keys to delete`);
    
    if (keys.length > 0) {
        await client.del(keys);
        console.log('Keys deleted');
    }
    
    // Heck, let's just clear all watchtower keys to be safe
    const allKeys = await client.keys('watchtower:*');
    if (allKeys.length > 0) {
        await client.del(allKeys);
        console.log(`Deleted ${allKeys.length} all watchtower keys`);
    }

    await client.quit();
}

flushCache();
