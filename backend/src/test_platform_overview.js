import './set_env.js';
import 'dotenv/config';

import { connectClickHouse } from './config/clickhouse.js';
import { connectDB } from './config/db.js';
import watchTowerService from './services/watchTowerService.js';

async function test() {
    try {
        console.log('Connecting to databases...');
        await connectDB();
        await connectClickHouse();
        
        console.log('--- TEST 1: No platform filter ("All" case) ---');
        const resAll = await watchTowerService.getPlatformOverview({
            brand: 'mamaearth',
            startDate: '2026-06-01',
            endDate: '2026-06-15'
        });
        
        const allRowAll = resAll.find(r => r.key === 'all');
        console.log('Response length:', resAll.length);
        console.log('Is "All" row present:', !!allRowAll);
        if (allRowAll) {
            console.log('All row details:', { key: allRowAll.key, label: allRowAll.label });
        }
        console.log('Other platforms returned:', resAll.map(r => r.label).join(', '));
        
        console.log('\n--- TEST 2: Specific platform filter ("zepto") ---');
        const resZepto = await watchTowerService.getPlatformOverview({
            brand: 'mamaearth',
            platform: 'zepto',
            startDate: '2026-06-01',
            endDate: '2026-06-15'
        });
        
        const allRowZepto = resZepto.find(r => r.key === 'all');
        console.log('Response length:', resZepto.length);
        console.log('Is "All" row present:', !!allRowZepto);
        console.log('Other platforms returned:', resZepto.map(r => r.label).join(', '));
        
        if (!!allRowAll && !allRowZepto) {
            console.log('\nSUCCESS: "All" row correctly hidden when specific platform is filtered, but present when no platform is selected.');
            process.exit(0);
        } else {
            console.error('\nFAILURE: Expected "All" row to be present in TEST 1 and absent in TEST 2.');
            process.exit(1);
        }
    } catch (err) {
        console.error('Error during test:', err);
        process.exit(1);
    }
}

test();
