import { queryClickHouse } from './src/config/clickhouse.js';
import dotenv from 'dotenv';
dotenv.config();

// We need to bypass the AsyncLocalStorage context requirement that sets DB, or just use mars directly
async function test() {
    process.env.CLICKHOUSE_DB = 'mars'; // Force db
    try {
        const query = `
            SELECT SUM(ifNull(toFloat64OrZero(toString(Sales)), 0)) as total_sales
            FROM mars.rb_pdp_olap 
            WHERE DATE BETWEEN '2024-01-01' AND '2024-03-31'
        `;
        const res = await queryClickHouse(query);
        console.log("Result:", res);
        
        // Also let's check what my string from 'return [{total_sales: result[0]?.total_sales || 0}]' evaluates to
        console.log("Return format:", [{ total_sales: res[0]?.total_sales || 0 }]);
    } catch (err) {
        console.error("Error:", err);
    }
}
test();
