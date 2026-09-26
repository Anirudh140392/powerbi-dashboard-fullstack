import { queryClickHouse } from './backend/src/config/clickhouse.js';

async function run() {
    try {
        console.log("Checking if we can join rb_ms_olap with rb_pdp_olap on web_pid...");
        const result = await queryClickHouse(`
            SELECT ms.web_pid, ms.item_name, pdp.Product_Subcategory
            FROM mamaearth.rb_ms_olap as ms
            JOIN (
                SELECT DISTINCT Web_Pid, Product_Subcategory 
                FROM mamaearth.rb_pdp_olap 
                WHERE Product_Subcategory IS NOT NULL AND Product_Subcategory != ''
            ) as pdp
            ON ms.web_pid = pdp.Web_Pid
            LIMIT 10
        `);
        console.log("Joined result samples:");
        console.log(result);

        console.log("\nChecking total count of distinct sub_categories via join:");
        const countRes = await queryClickHouse(`
            SELECT DISTINCT pdp.Product_Subcategory as sub_category
            FROM mamaearth.rb_ms_olap as ms
            JOIN (
                SELECT DISTINCT Web_Pid, Product_Subcategory 
                FROM mamaearth.rb_pdp_olap 
                WHERE Product_Subcategory IS NOT NULL AND Product_Subcategory != ''
            ) as pdp
            ON ms.web_pid = pdp.Web_Pid
        `);
        console.log("Sub-categories found:", countRes.map(r => r.sub_category));
    } catch (e) {
        console.error("Error joining tables:", e);
    }
    process.exit(0);
}

run();
