import { createClient } from 'redis';
import dotenv from 'dotenv';
dotenv.config();

const client = createClient({
    url: `redis://${process.env.REDIS_HOST || '127.0.0.1'}:${process.env.REDIS_PORT || 6379}`
});

client.on('error', err => console.log('Redis Client Error', err));

async function flush() {
    await client.connect();
    await client.flushAll();
    console.log('Successfully flushed Redis cache!');
    await client.disconnect();
}

flush();
