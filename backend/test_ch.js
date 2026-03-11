const { queryClickHouse } = require('./src/config/clickhouse.js');

async function run() {
    const q1 = "SELECT SUM(ad_quantity_sold) as orders, SUM(ad_click) as clicks, SUM(impressions) as impressions FROM mars.rca_pm_olap WHERE Platform = 'Blinkit'";
    const res = await queryClickHouse(q1);
    console.log('Blinkit All:', res);

    const q2 = "SELECT SUM(ad_quantity_sold) as orders, SUM(ad_click) as clicks, SUM(impressions) as impressions FROM mars.rca_pm_olap";
    const res2 = await queryClickHouse(q2);
    console.log('All:', res2);

    const q3 = "SELECT SUM(ad_quantity_sold) as orders, SUM(ad_click) as clicks, SUM(impressions) as impressions FROM mars.rca_pm_olap WHERE brand LIKE '%MARS%' OR brand LIKE '%Mars%' OR brand LIKE '%Neno%'";
    const res3 = await queryClickHouse(q3);
    console.log('Specific Brands:', res3);
    process.exit();
}
run();
