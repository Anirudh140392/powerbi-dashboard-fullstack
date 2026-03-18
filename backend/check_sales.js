
import { queryClickHouse } from './src/config/clickhouse.js';

async function checkData() {
    try {
        const query = `
            SELECT 
                p.Product, 
                p.Web_Pid, 
                m.item_name, 
                m.sales 
            FROM rb_pdp_olap p 
            INNER JOIN rb_brand_ms m ON p.Web_Pid = m.web_pid 
            WHERE p.Product LIKE '%KitKat%' 
            LIMIT 5
        `;
        const results = await queryClickHouse(query);
        console.log(JSON.stringify(results, null, 2));
    } catch (e) {
        console.error(e);
    }
}

checkData();
