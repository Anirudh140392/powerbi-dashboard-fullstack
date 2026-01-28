
import { queryClickHouse } from './backend/src/config/clickhouse.js';
import dotenv from 'dotenv';
dotenv.config({ path: './backend/.env' });

async function checkMaxDates() {
    try {
        const queries = [
            { table: 'rb_pdp_olap', col: 'DATE' },
            { table: 'rb_kw', col: 'kw_crawl_date' },
            { table: 'rb_brand_ms', col: 'created_on' }
        ];

        for (const q of queries) {
            const result = await queryClickHouse(`SELECT MAX(toDate(${q.col})) as maxDate FROM ${q.table}`);
            console.log(`${q.table}: ${result?.[0]?.maxDate}`);
        }
    } catch (e) {
        console.error(e);
    }
}

checkMaxDates();
