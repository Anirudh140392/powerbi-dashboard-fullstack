
import { queryClickHouse } from './src/config/clickhouse.js';

async function inspectData() {
    try {
        console.log('--- Inspecting rb_kw_olap table ---');
        
        const countRes = await queryClickHouse('SELECT count() as total FROM rb_kw_olap');
        console.log('Total records:', countRes[0].total);

        const dateRes = await queryClickHouse('SELECT MAX(DATE) as maxDate, MIN(DATE) as minDate FROM rb_kw_olap');
        console.log('Date range:', dateRes[0].minDate, 'to', dateRes[0].maxDate);

        const flagRes = await queryClickHouse('SELECT flag, count() as count FROM rb_kw_olap GROUP BY flag');
        console.log('Flag distribution:', JSON.stringify(flagRes, null, 2));

        const typeRes = await queryClickHouse('SELECT keyword_type, count() as count FROM rb_kw_olap GROUP BY keyword_type');
        console.log('Keyword types:', JSON.stringify(typeRes, null, 2));

        const sampleRes = await queryClickHouse('SELECT * FROM rb_kw_olap LIMIT 1');
        console.log('Sample record:', JSON.stringify(sampleRes[0], null, 2));

        const nullCreatedRes = await queryClickHouse('SELECT count() as count FROM rb_kw_olap WHERE created_on IS NULL');
        console.log('Records with NULL created_on:', nullCreatedRes[0].count);

        const rbKwCountRes = await queryClickHouse("SELECT count() as count FROM rb_kw_olap WHERE toString(keyword_is_rb_product) = '1'");
        console.log("Records with keyword_is_rb_product = '1':", rbKwCountRes[0].count);

        const rbKwCountRes2 = await queryClickHouse("SELECT count() as count FROM rb_kw_olap WHERE keyword_is_rb_product = 1");
        console.log("Records with keyword_is_rb_product = 1:", rbKwCountRes2[0].count);

        const rankRes = await queryClickHouse('SELECT keyword_search_rank, count() as count FROM rb_kw_olap GROUP BY keyword_search_rank ORDER BY keyword_search_rank LIMIT 15');
        console.log('Rank distribution:', JSON.stringify(rankRes, null, 2));

    } catch (err) {
        console.error('Error:', err);
    }
}

inspectData();
