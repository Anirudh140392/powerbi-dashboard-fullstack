import { queryClickHouse } from './backend/src/config/clickhouse.js';
import 'dotenv/config';

async function verify() {
    try {
        console.log('--- Checking Columns in rb_pdp_olap ---');
        const columns = await queryClickHouse(`DESCRIBE TABLE rb_pdp_olap`);
        const listingCols = columns.filter(c => c.name.toLowerCase().includes('listing'));
        console.log('Listing related columns:', listingCols.map(c => `${c.name} (${c.type})`));

        console.log('\n--- Checking Data for Competition Brands (Comp_flag = 1) ---');
        const hasListingPercent = listingCols.some(c => c.name === 'listing_percent');
        const hasListingPercentage = listingCols.some(c => c.name === 'listing_percentage');

        let selectParts = ['Brand'];
        if (hasListingPercent) selectParts.push('listing_percent');
        if (hasListingPercentage) selectParts.push('listing_percentage');

        const query = `SELECT ${selectParts.join(', ')} FROM rb_pdp_olap WHERE toString(Comp_flag) = '1' LIMIT 10`;
        const data = await queryClickHouse(query);
        console.log('Sample Data:', JSON.stringify(data, null, 2));

        if (data.length > 0) {
            if (hasListingPercent) {
                const avgLP = data.reduce((acc, curr) => acc + parseFloat(curr.listing_percent || 0), 0) / data.length;
                console.log('\nAverage listing_percent in sample:', avgLP);
            }

            if (hasListingPercentage) {
                const avgLPA = data.reduce((acc, curr) => acc + parseFloat(curr.listing_percentage || 0), 0) / data.length;
                console.log('Average listing_percentage in sample:', avgLPA);
            }
        } else {
            console.log('No competition data found in rb_pdp_olap with Comp_flag = \'1\'');
        }

    } catch (error) {
        console.error('Error during verification:', error);
    }
    process.exit(0);
}

verify();
