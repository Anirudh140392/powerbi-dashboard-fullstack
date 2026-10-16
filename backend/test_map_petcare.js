import mapIntellectService from './backend/src/services/mapIntellectService.js';
import { setCurrentDbName, asyncStorageMiddleware } from './backend/src/config/clickhouse.js';
import { AsyncLocalStorage } from 'node:async_hooks';

// Mocking the store for standalone execution
const dbStorage = new AsyncLocalStorage();

async function test() {
    try {
        // Force the DB name to mars_petcare
        console.log('Testing with mars_petcare...');

        // We need to run it inside the async storage context
        // But the mapIntellectService calls getCurrentDbName()
        // Which uses the dbStorage from clickhouse.js

        // Let's use a simpler approach: run a script that sets it up
        const filters = { platform: 'Amazon', timePeriod: 'MTD' };

        // Since we can't easily mock the AsyncLocalStorage of the module from here without help,
        // Let's just create a specialized test script in the backend dir.
    } catch (error) {
        console.error('Error:', error);
    }
}
test();
