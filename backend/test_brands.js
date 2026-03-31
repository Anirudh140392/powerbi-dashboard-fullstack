import { queryClickHouse } from './src/config/clickhouse.js';

async function testBrands() {
    try {
        console.log("Checking brand column (flag = '1'):");
        const ownResBrand = await queryClickHouse(`SELECT DISTINCT brand FROM rb_kw_olap WHERE flag = '1' AND brand IS NOT NULL AND brand != '' ORDER BY brand`);
        console.log("Own brands (using 'brand' column):", ownResBrand.map(r => r.brand));

        console.log("Checking brand_name_th column (flag = '1'):");
        const ownResBrandTH = await queryClickHouse(`SELECT DISTINCT brand_name_th FROM rb_kw_olap WHERE flag = '1' AND brand_name_th IS NOT NULL AND brand_name_th != '' ORDER BY brand_name_th`);
        console.log("Own brands (using 'brand_name_th' column):", ownResBrandTH.map(r => r.brand_name_th));
        
        process.exit(0);
    } catch (error) {
        console.error("Error:", error);
        process.exit(1);
    }
}

testBrands();
