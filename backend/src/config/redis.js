import { createClient } from 'redis';
import dotenv from 'dotenv';

dotenv.config();

class RedisClient {
    constructor() {
        this.client = null;
        this.isConnected = false;
        this.isEnabled = process.env.REDIS_ENABLED === 'true';
    }

    async connect() {
        if (!this.isEnabled) {
            console.log('Redis is disabled via REDIS_ENABLED environment variable');
            return;
        }

        try {
            this.client = createClient({
                socket: {
                    host: process.env.REDIS_HOST || '127.0.0.1',
                    port: parseInt(process.env.REDIS_PORT || '6379'),
                    tls: process.env.REDIS_TLS === 'true' ? {} : undefined,
                },
                password: process.env.REDIS_PASSWORD || undefined,
                database: parseInt(process.env.REDIS_DB || '0'),
            });

            // Error handler
            this.client.on('error', (err) => {
                console.error('Redis Client Error:', err);
                this.isConnected = false;
            });

            // Connection events
            this.client.on('connect', () => {
                console.log('✅ Redis client connecting...');
            });

            this.client.on('ready', () => {
                console.log('✅ Redis client ready');
                this.isConnected = true;
            });

            this.client.on('end', () => {
                console.log('❌ Redis client disconnected');
                this.isConnected = false;
            });

            await this.client.connect();

            // Test connection
            await this.client.ping();
            console.log('✅ Redis connection successful');

        } catch (error) {
            console.error('❌ Failed to connect to Redis:', error.message);
            console.log('⚠️  Application will continue without caching');
            this.isConnected = false;
            this.client = null;
        }
    }

    async disconnect() {
        if (this.client && this.isConnected) {
            await this.client.quit();
            this.isConnected = false;
            console.log('Redis client disconnected');
        }
    }

    getClient() {
        return this.client;
    }

    isReady() {
        return this.isEnabled && this.isConnected && this.client !== null;
    }
}

// Singleton instance
const redisClient = new RedisClient();

export default redisClient;
