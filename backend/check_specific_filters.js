import { queryClickHouse, getCurrentDbName } from './src/config/clickhouse.js';
import dayjs from 'dayjs';

async function checkData() {
    const dbName = await getCurrentDbName();
    console.log('Current DB:', dbName);

    const filters = {
        platform: 'Blinkit',
        category: 'Chocolates (Gifting)',
        productCategory: 'Silver',
        startDate: '2026-03-01',
        endDate: '2026-03-11'
    };

    console.log('Checking for filters:', filters);

    // 1. Check if ANY data exists for the dates
    const dateCheck = await queryClickHouse(`
        SELECT COUNT(*) as count 
        FROM rb_pdp_olap 
        WHERE DATE BETWEEN '${filters.startDate}' AND '${filters.endDate}'
    `);
    console.log(`Total records between ${filters.startDate} and ${filters.endDate}:`, dateCheck[0].count);

    // 2. Check Platform
    const platformCheck = await queryClickHouse(`
        SELECT COUNT(*) as count 
        FROM rb_pdp_olap 
        WHERE Platform = 'Blinkit' 
        AND DATE BETWEEN '${filters.startDate}' AND '${filters.endDate}'
    `);
    console.log('Blinkit records:', platformCheck[0].count);

    // 3. Check Category mappings
    const catCheck = await queryClickHouse(`
        SELECT Category, COUNT(*) as count 
        FROM rb_pdp_olap 
        WHERE DATE BETWEEN '${filters.startDate}' AND '${filters.endDate}'
        AND Platform = 'Blinkit'
        GROUP BY Category
    `);
    console.log('Categories for Blinkit in date range:', catCheck);

    // 4. Check Product_type mappings
    const ptCheck = await queryClickHouse(`
        SELECT Product_type, COUNT(*) as count 
        FROM rb_pdp_olap 
        WHERE DATE BETWEEN '${filters.startDate}' AND '${filters.endDate}'
        AND Platform = 'Blinkit'
        GROUP BY Product_type
    `);
    console.log('Product_types for Blinkit in date range:', ptCheck);

    // 5. Check specific combination
    const specificCheck = await queryClickHouse(`
        SELECT COUNT(*) as count 
        FROM rb_pdp_olap 
        WHERE Platform = 'Blinkit'
        AND lower(Category) = 'chocolates (gifting)'
        AND lower(Product_type) = 'silver'
        AND DATE BETWEEN '${filters.startDate}' AND '${filters.endDate}'
    `);
    console.log('Specific combination (lowercased) count:', specificCheck[0].count);

}

checkData().catch(console.error);
