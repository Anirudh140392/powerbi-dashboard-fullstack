import mapIntellectService from './src/services/mapIntellectService.js';
import { AsyncLocalStorage } from 'node:async_hooks';

// We need to access the dbStorage from clickhouse.js to mock it
// But it's not exported. However, we can use the middleware pattern.

import { asyncStorageMiddleware } from './src/config/clickhouse.js';

async function test() {
    // We'll wrap the execution in a custom store run if we can't use the middleware
    // Actually, let's just modify the service temporarily or use a simpler check.

    // Better: let's run the service function and see what it returns for mars_petcare
    // I will write a script that imports the service and runs it.

    // To handle the DB switching, I'll temporarily modify the .env or just use a custom script that doesn't rely on the global config.

    console.log('--- Testing Map Intellect Service for mars_petcare ---');
    const filters = { platform: 'Amazon', timePeriod: 'MTD' };

    // I'll use a hack to set the DB name if I can't access AsyncLocalStorage
    // But wait, if I run this as a script, I can just set process.env.CLICKHOUSE_DB
    process.env.CLICKHOUSE_DB = 'mars_petcare';

    try {
        const data = await mapIntellectService.getMapIntellectData(filters);
        console.log('Result Period:', data.period);
        console.log('Result Cities Count:', data.cities.length);
        if (data.cities.length > 0) {
            console.log('Sample Cities:', data.cities.slice(0, 5));
        } else {
            console.log('NO CITIES FOUND');
        }
    } catch (error) {
        console.error('Error during service call:', error);
    }
}

test();
