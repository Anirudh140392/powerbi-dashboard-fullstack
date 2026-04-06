import dotenv from 'dotenv';
dotenv.config({ path: './.env' });
import { queryClickHouse } from './src/config/clickhouse.js';

async function verifyQuery() {
    try {
        const MARS_BRANDS = ['boomer', 'bounty', 'doublemint', 'galaxy', 'm&m', 'mars', 'orbit', 'skittles', 'snickers', 'twix'];
        const MARS_BRANDS_SQL = MARS_BRANDS.map(b => `'${b}'`).join(', ');

        const sql = `
            SELECT 
                sum(toInt32(overall)) as total_kws,
                sumIf(toInt32(overall), lower(brand_name_th) IN (${MARS_BRANDS_SQL})) as rb_kw_olaps
            FROM rb_kw_olap
            WHERE DATE >= yesterday()
        `;
        console.log('Running Query:', sql);
        const res = await queryClickHouse(sql);
        console.log('Result:', JSON.stringify(res, null, 2));

        const drillSql = `
            SELECT 
                lower(brand_name_th) as name,
                sum(toInt32(overall)) as brand_kws
            FROM rb_kw_olap
            WHERE DATE >= yesterday() AND lower(brand_name_th) IN (${MARS_BRANDS_SQL})
            GROUP BY name
            ORDER BY brand_kws DESC
            LIMIT 5
        `;
        console.log('Running Drilldown Query:', drillSql);
        const resDrill = await queryClickHouse(drillSql);
        console.log('Drilldown Result:', JSON.stringify(resDrill, null, 2));

    } catch (err) {
        console.error('ERROR:', err);
    }
}

verifyQuery();
