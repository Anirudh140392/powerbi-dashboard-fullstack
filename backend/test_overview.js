import { createClient } from '@clickhouse/client';
import watchTowerService from './src/services/watchTowerService.js';
import clickhouseModule from './src/config/clickhouse.js';
import dotenv from 'dotenv';
dotenv.config();

const { asyncLocalStorage } = clickhouseModule;

async function run() {
    asyncLocalStorage.run(new Map(), async () => {
        // Mock setting the dynamic DB to mars (or whatever)
        clickhouseModule.setCurrentDbName('mars');

        try {
            const filters = { months: 1, channel: 'E-commerce' };
            const res = await watchTowerService.getOverview(filters);
            console.log('SUCCESS:', typeof res === 'object' ? 'Got object with keys: ' + Object.keys(res).join(', ') : res);
        } catch (error) {
            console.error('API ERROR TRACE:');
            console.error(error);
        }
    });
}

run();
