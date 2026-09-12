import { queryClickHouse } from './src/config/clickhouse.js';

async function checkMsOlapPlatforms() {
    try {
        console.log('--- Platforms in rb_ms_olap ---');
        const platforms = await queryClickHouse(`SELECT DISTINCT platform FROM rb_ms_olap WHERE platform IS NOT NULL AND platform != ''`);
        console.log(platforms);

        console.log('\n--- Sample Brands in rb_ms_olap ---');
        const brands = await queryClickHouse(`SELECT DISTINCT brand FROM rb_ms_olap WHERE brand IS NOT NULL AND brand != '' LIMIT 20`);
        console.log(brands);

        console.log('\n--- Sample group_brand in rb_ms_olap ---');
        const groupBrands = await queryClickHouse(`SELECT DISTINCT group_brand FROM rb_ms_olap WHERE group_brand IS NOT NULL AND group_brand != '' LIMIT 20`);
        console.log(groupBrands);

        process.exit(0);
    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    }
}

checkMsOlapPlatforms();
