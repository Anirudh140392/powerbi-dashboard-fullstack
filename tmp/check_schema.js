import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from backend directory
dotenv.config({ path: path.join(__dirname, '../backend/.env') });

import { queryClickHouse } from '../backend/src/config/clickhouse.js';

(async () => {
    try {
        console.log('--- rb_kw Schema ---');
        const res = await queryClickHouse('DESCRIBE rb_kw');
        console.table(res.map(c => ({ name: c.name, type: c.type })));

        console.log('\n--- rb_pdp Schema ---');
        const res2 = await queryClickHouse('DESCRIBE rb_pdp');
        console.table(res2.map(c => ({ name: c.name, type: c.type })));

        console.log('\n--- Category Sample ---');
        const cats = await queryClickHouse('SELECT DISTINCT keyword_category FROM rb_kw LIMIT 20');
        console.log(cats);

        console.log('\n--- Brand Sample ---');
        const brands = await queryClickHouse('SELECT DISTINCT brand_name FROM rb_kw LIMIT 20');
        console.log(brands);

    } catch (e) {
        console.error('Error:', e.message);
    }
})();
