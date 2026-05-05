
import { queryClickHouse } from './backend/src/config/clickhouse.js';

async function checkData() {
    const sku = 'zebronics 3 w wireless bluetooth speaker (zeb-county)';
    const query = `
        SELECT 
            keyword_search_product,
            brand,
            platform_name,
            keyword_category,
            count() as cnt,
            sum(toInt32(overall)) as total_overall
        FROM rb_kw_olap
        WHERE keyword_search_product = '${sku}'
        GROUP BY keyword_search_product, brand, platform_name, keyword_category
    `;
    const results = await queryClickHouse(query);
    console.log('Results:', JSON.stringify(results, null, 2));
}

checkData();
