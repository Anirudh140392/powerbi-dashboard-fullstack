import { getTableColumns, resolveColumn, queryClickHouse } from './src/config/clickhouse.js';
async function test() {
    try {
        const cols = await getTableColumns('rb_pm_olap');
        console.log("Cols:", cols.map(c => c.name));
        console.log("Resolved:", resolveColumn(cols, 'Ad_Quantity_sold'));
        console.log("Original query that user gave:", await queryClickHouse("SELECT SUM(ad_quantity_sold) / SUM(ad_click) *100 FROM rb_pm_olap where Platform='Instamart' AND DATE='2026-03-18' LIMIT 100"));
    } catch (e) {
        console.error(e);
    }
}
test();
