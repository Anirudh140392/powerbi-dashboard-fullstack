import { queryClickHouse } from './src/config/clickhouse.js';

async function checkValues() {
    try {
        // Check a random product in rb_pdp_olap
        const query = `
            SELECT 
                Product, 
                Selling_Price, 
                PPU, 
                Weight,
                PPU * 100 as price_per_100g
            FROM rb_pdp_olap 
            WHERE Selling_Price > 0 AND PPU > 0 AND Weight != '' 
            LIMIT 5
        `;
        const data = await queryClickHouse(query);
        console.log("--- rb_pdp_olap Samples ---");
        data.forEach(row => {
            const manual = (row.Selling_Price / parseFloat(row.Weight)) * 100;
            console.log(`Product: ${row.Product_Title}`);
            console.log(`  Price: ${row.Selling_Price}, Weight: ${row.Weight}`);
            console.log(`  PPU (DB): ${row.PPU}`);
            console.log(`  Price/100g (PPU*100): ${row.price_per_100g.toFixed(2)}`);
            console.log(`  Manual (Price/Weight*100): ${manual.toFixed(2)}`);
            console.log(`  Match? ${Math.abs(row.price_per_100g - manual) < 0.1 ? 'YES' : 'NO'}`);
        });
    } catch (err) {
        console.error(err);
    }
}

checkValues();
