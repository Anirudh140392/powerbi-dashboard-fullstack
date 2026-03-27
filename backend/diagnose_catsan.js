const { queryClickHouse } = require('./src/config/clickhouse.js');

async function checkCatsan() {
    try {
        const sql = `
            SELECT 
                DATE, 
                Sales, 
                Product, 
                Platform,
                Comp_flag
            FROM rb_pdp_olap 
            WHERE Brand LIKE '%Catsan%' 
            AND Sales != 0 
            ORDER BY DATE DESC 
            LIMIT 50
        `;
        const res = await queryClickHouse(sql);
        console.log('--- Catsan Sales Data ---');
        console.table(res);
        
        const sumSql = `
            SELECT 
                Comp_flag,
                SUM(Sales) as total_sales,
                COUNT(*) as row_count
            FROM rb_pdp_olap 
            WHERE Brand LIKE '%Catsan%'
            GROUP BY Comp_flag
        `;
        const summary = await queryClickHouse(sumSql);
        console.log('--- Summary by Comp_flag ---');
        console.table(summary);

    } catch (e) {
        console.error('Error querying ClickHouse:', e);
    }
}

checkCatsan();
