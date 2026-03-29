import { queryClickHouse } from './src/config/clickhouse.js';
import fs from 'fs';

async function verify() {
    const brand = 'Mars';
    const startDate = '2026-03-13';
    const endDate = '2026-03-28';
    const pStartDate = '2026-02-25';
    const pEndDate = '2026-03-12';

    try {
        const q = (s, e) => `SELECT SUM(Sales) as total FROM rb_pdp_olap WHERE Brand LIKE '%${brand}%' AND Marketplace_Engine = 'Amazon' AND Comp_flag = '0' AND toDate(DATE) BETWEEN '${s}' AND '${e}'`;
        const c = await queryClickHouse(q(startDate, endDate));
        const p = await queryClickHouse(q(pStartDate, pEndDate));
        
        const results = {
            current: c[0].total,
            previous: p[0].total
        };
        fs.writeFileSync('db_verify.json', JSON.stringify(results, null, 2));
        console.log('Verification saved to db_verify.json');
    } catch (e) {
        console.error(e);
    }
}
verify();
