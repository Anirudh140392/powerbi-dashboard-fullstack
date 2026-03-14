import { queryClickHouse } from './src/config/clickhouse.js';

async function checkCompFlags() {
    try {
        console.log('Checking Comp_flag values for various brands...');
        const query = `
            SELECT 
                Brand, 
                Comp_flag, 
                count() as count
            FROM rb_pdp_olap
            WHERE Brand IN ('Cadbury', 'Amul', 'Boomer', 'Bounty', 'Center Fresh', 'Center Fruit', 'Doublemint', 'Orbit', 'Mars', 'Snickers')
            GROUP BY Brand, Comp_flag
            ORDER BY Brand, Comp_flag
        `;
        
        const results = await queryClickHouse(query);
        console.table(results);

        const allBrandsQuery = `
            SELECT 
                Brand, 
                argMin(Comp_flag, Brand) as flag,
                count() as count
            FROM rb_pdp_olap
            GROUP BY Brand
            ORDER BY count DESC
            LIMIT 20
        `;
        console.log('\nTop 20 brands by record count:');
        const topBrands = await queryClickHouse(allBrandsQuery);
        console.table(topBrands);

    } catch (error) {
        console.error('Error:', error);
    } finally {
        process.exit(0);
    }
}

checkCompFlags();
