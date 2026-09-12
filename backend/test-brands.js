import * as dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env') });

import { queryClickHouse } from './src/config/clickhouse.js';

async function run() {
    try {
        const query1 = `
            SELECT Brand, SUM(ifNull(toFloat64OrZero(toString(Sales)), 0)) as total_sales
            FROM rb_pdp_olap
            WHERE toDate(DATE) BETWEEN '2026-02-01' AND '2026-02-21' AND Comp_flag = 0
            GROUP BY Brand
            ORDER BY total_sales DESC
        `;
        const result1 = await queryClickHouse(query1);
        console.log("Sales Split by Brand:");
        console.table(result1);
        
        process.exit(0);
    } catch(e) {
        console.error(e);
        process.exit(1);
    }
}
run();
