import { queryClickHouse } from './src/config/clickhouse.js';

async function verify() {
    try {
        const query = `
            SELECT 
                ROUND(countIf(toString(flag) = '1') * 100.0 / nullIf(count(*), 0), 2) AS overall_sos,
                ROUND(countIf(toString(flag) = '1' AND toString(spons_flag) = '1') * 100.0 / nullIf(countIf(toString(spons_flag) = '1'), 0), 2) AS ad_sos,
                ROUND(countIf(toString(flag) = '1' AND toString(spons_flag) != '1') * 100.0 / nullIf(countIf(toString(spons_flag) != '1'), 0), 2) AS org_sos
            FROM rb_kw_olap
            WHERE toDate(kw_crawl_date) = '2026-03-25'
        `;
        const result = await queryClickHouse(query);
        console.log('Verification Result:', JSON.stringify(result, null, 2));
    } catch (err) {
        console.error('Query Failed:', err.message);
    }
}

verify();
