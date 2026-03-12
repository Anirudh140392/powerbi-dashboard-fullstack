import { queryClickHouse } from './config/clickhouse.js';
async function checkData() {
    try {
        console.log("--- mars.rb_pdp_olap sample ---");
        const resMars = await queryClickHouse("SELECT Brand, Category, Product_type FROM mars.rb_pdp_olap LIMIT 10");
        console.log(JSON.stringify(resMars, null, 2));

        console.log("--- colpal.rb_pdp_olap sample ---");
        const resColpal = await queryClickHouse("SELECT Brand, Category, Product_type FROM colpal.rb_pdp_olap LIMIT 10");
        console.log(JSON.stringify(resColpal, null, 2));

        console.log("--- mars.rca_pm_olap sample ---");
        const resPm = await queryClickHouse("SELECT brand, category FROM mars.rca_pm_olap LIMIT 10");
        console.log(JSON.stringify(resPm, null, 2));

    } catch (err) {
        console.error(err);
    }
}
checkData();
