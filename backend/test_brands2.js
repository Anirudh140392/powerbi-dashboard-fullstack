import { queryClickHouse } from './src/config/clickhouse.js';
import fs from 'fs';

async function testBrands() {
    try {
        const ownResBrand = await queryClickHouse(`SELECT DISTINCT brand FROM rb_kw_olap WHERE flag = '1' AND brand IS NOT NULL AND brand != '' ORDER BY brand`);
        const brands = ownResBrand.map(r => r.brand);
        fs.writeFileSync('brands_output.json', JSON.stringify(brands, null, 2));
        console.log('Saved to brands_output.json');
        
        process.exit(0);
    } catch (error) {
        console.error("Error:", error);
        process.exit(1);
    }
}

testBrands();
