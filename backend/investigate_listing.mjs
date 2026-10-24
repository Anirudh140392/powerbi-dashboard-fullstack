import { queryClickHouse } from './src/config/clickhouse.js';
import 'dotenv/config';

async function verify() {
    try {
        console.log('--- Checking listing_percent data in rb_pdp_olap ---');

        // Check for Comp_flag = 1
        const compData = await queryClickHouse(`
            SELECT Brand, listing_percent, count() as count
            FROM rb_pdp_olap 
            WHERE toString(Comp_flag) = '1' 
            GROUP BY Brand, listing_percent
            LIMIT 20
        `);
        console.log('Competition Brands Listing Data:', JSON.stringify(compData, null, 2));

        // Check if there are ANY non-zero/non-null values for Comp_flag = 1
        const nonZeroComp = await queryClickHouse(`
            SELECT count() as total
            FROM rb_pdp_olap 
            WHERE toString(Comp_flag) = '1' 
              AND listing_percent IS NOT NULL 
              AND listing_percent != '' 
              AND toFloat64OrZero(toString(listing_percent)) > 0
        `);
        console.log('Total non-zero listing_percent for competition:', nonZeroComp[0]?.total);

        // Check for Comp_flag != 1 for comparison
        const ourData = await queryClickHouse(`
            SELECT Brand, avg(ifNull(toFloat64OrZero(toString(listing_percent)), 0)) as avg_lp
            FROM rb_pdp_olap 
            WHERE toString(Comp_flag) = '0'
            GROUP BY Brand
            LIMIT 5
        `);
        console.log('Our Brands Average listing_percent:', JSON.stringify(ourData, null, 2));

    } catch (error) {
        console.error('Error during data investigation:', error);
    }
    process.exit(0);
}

verify();
