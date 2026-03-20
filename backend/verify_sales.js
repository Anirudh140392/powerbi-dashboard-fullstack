import { queryClickHouse } from './src/config/clickhouse.js';
import dayjs from 'dayjs';

async function verifySalesMatrix() {
    console.log('--- VERIFYING SALES CATEGORY MATRIX FIX ---');
    try {
        const end = dayjs();
        const mtdS = end.startOf('month').format('YYYY-MM-DD');
        const mtdE = end.format('YYYY-MM-DD');

        // This is a simplified version of the query in getCategorySalesMatrix
        const query = `
            SELECT 
                Category as category,
                sum(if(toDate(DATE) BETWEEN '${mtdS}' AND '${mtdE}', toFloat64OrZero(toString(Sales)), 0)) as mtd
            FROM rb_pdp_olap
            WHERE toString(Comp_flag) = '0'
            GROUP BY Category
            HAVING mtd > 0
            LIMIT 5
        `;
        
        console.log('Executing query:', query);
        const results = await queryClickHouse(query);
        
        if (results.length > 0) {
            console.log('✅ SUCCESS: Found sales data for categories:');
            console.table(results);
        } else {
            console.error('❌ FAILED: No sales data found for any category with Comp_flag = 0');
            
            // Check if Comp_flag = 0 has ANY sales
            const checkSales = await queryClickHouse(`SELECT SUM(toFloat64OrZero(toString(Sales))) as total FROM rb_pdp_olap WHERE toString(Comp_flag) = '0'`);
            console.log('Total sales for Comp_flag=0:', checkSales[0].total);
        }

    } catch (err) {
        console.error('Error during verification:', err.message);
    }
}

verifySalesMatrix();
